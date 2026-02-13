const storage = require('./storage');
const EmailImage = require('./model');
const { parsePaginationParams } = require('../../shared/utils/pagination');

// 모듈 레벨 상수 (매 함수 호출마다 읽지 않도록 최적화)
const STORAGE_TYPE = process.env.IMAGE_STORAGE || 'local';
const IS_MONGODB_STORAGE = STORAGE_TYPE === 'httpwebserver';

// 스토리지 초기화
async function initialize() {
  await storage.initialize();
  if (!IS_MONGODB_STORAGE) {
    console.warn('  ⚠ IMAGE_STORAGE is not "httpwebserver" (current: "%s"). Email Image page will use in-memory filtering.', STORAGE_TYPE);
  }
}

// 이미지 업로드
async function uploadImage(file, prefix, context = {}) {
  // 모든 스토리지 타입에 prefix와 context 전달
  const result = await storage.uploadImage(file, prefix, context);
  return { ...result, prefix: result.prefix || prefix };
}

// 이미지 조회
async function getImage(prefix, name) {
  if (IS_MONGODB_STORAGE) {
    return await storage.getImage(prefix, name);
  }
  // Local storage uses id (name) only
  return await storage.getImage(name);
}

// 이미지 삭제
async function deleteImage(prefix, name) {
  if (IS_MONGODB_STORAGE) {
    return await storage.deleteImage(prefix, name);
  }
  // Local storage uses id (name) only
  return await storage.deleteImage(name);
}

// 이미지 목록 조회
async function listImages(prefix) {
  return await storage.listImages(prefix);
}

// 이미지 URL 생성 (프론트엔드 썸네일용 - WebManager API)
function getImageUrl(prefix, name, req) {
  const protocol = req.protocol;
  const host = req.get('host');

  if (IS_MONGODB_STORAGE) {
    return `${protocol}://${host}/api/images/${encodeURIComponent(prefix)}/${name}`;
  }
  return `${protocol}://${host}/api/images/${name}`;
}

// 이메일용 이미지 URL 생성 (HttpWebServer 직접 접근)
function getEmailImageUrl(prefix, name) {
  if (IS_MONGODB_STORAGE) {
    return storage.getImageUrl(prefix, name);
  }
  // 로컬 스토리지는 이메일용 URL을 지원하지 않음
  return null;
}

// ====================================================================
// In-memory helpers (local storage fallback)
// ====================================================================

function _parseCommaSeparated(value) {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function _filterImages(images, filters = {}) {
  const filterProcesses = _parseCommaSeparated(filters.process);
  const filterModels = _parseCommaSeparated(filters.model);
  const filterCodes = _parseCommaSeparated(filters.code);
  const filterSubcodes = _parseCommaSeparated(filters.subcode);
  const userProcesses = filters.userProcesses || [];

  let result = images;

  if (filterProcesses.length > 0) {
    result = result.filter(img => filterProcesses.includes(img.process));
  } else if (userProcesses.length > 0) {
    result = result.filter(img => userProcesses.includes(img.process));
  }

  if (filterModels.length > 0) {
    result = result.filter(img => filterModels.includes(img.model));
  }

  if (filterCodes.length > 0) {
    result = result.filter(img => filterCodes.includes(img.code));
  }

  if (filterSubcodes.length > 0) {
    result = result.filter(img => filterSubcodes.includes(img.subcode));
  }

  return result;
}

function _formatImageWithUrl(img, req) {
  const imgPrefix = img.prefix || 'DEFAULT';
  const imgName = img.name || img.id;
  const url = req ? getImageUrl(imgPrefix, imgName, req) : null;
  const emailUrl = getEmailImageUrl(imgPrefix, imgName);

  return {
    id: imgName,
    prefix: imgPrefix,
    name: imgName,
    filename: img.filename || img.fileName,
    mimetype: img.mimetype,
    size: img.size,
    createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt,
    process: img.process || '',
    model: img.model || '',
    code: img.code || '',
    subcode: img.subcode || '',
    url,
    emailUrl: emailUrl || url
  };
}

// ====================================================================
// Email Image Page API functions
// ====================================================================

/**
 * Get distinct processes from image records
 */
async function getDistinctProcesses() {
  try {
    if (IS_MONGODB_STORAGE) {
      const processes = await EmailImage.distinct('process', { process: { $ne: '' } });
      return processes.sort();
    }
    // Local: in-memory distinct
    const images = await storage.listImages();
    const processes = [...new Set(images.map(img => img.process).filter(Boolean))];
    return processes.sort();
  } catch (error) {
    console.error('getDistinctProcesses error:', error);
    return [];
  }
}

/**
 * Get distinct models filtered by process
 */
async function getDistinctModels(processFilter, userProcesses) {
  try {
    if (IS_MONGODB_STORAGE) {
      const query = { model: { $ne: '' } };
      const filterProcesses = _parseCommaSeparated(processFilter);
      if (filterProcesses.length > 0) {
        query.process = { $in: filterProcesses };
      } else if (userProcesses && userProcesses.length > 0) {
        query.process = { $in: userProcesses };
      }
      const models = await EmailImage.distinct('model', query);
      return models.sort();
    }
    // Local: in-memory distinct
    const images = await storage.listImages();
    const filtered = _filterImages(images, { process: processFilter, userProcesses });
    const models = [...new Set(filtered.map(img => img.model).filter(Boolean))];
    return models.sort();
  } catch (error) {
    console.error('getDistinctModels error:', error);
    return [];
  }
}

/**
 * Get distinct codes filtered by process and model
 */
async function getDistinctCodes(processFilter, modelFilter, userProcesses) {
  try {
    if (IS_MONGODB_STORAGE) {
      const query = { code: { $ne: '' } };
      const filterProcesses = _parseCommaSeparated(processFilter);
      const filterModels = _parseCommaSeparated(modelFilter);
      if (filterProcesses.length > 0) {
        query.process = { $in: filterProcesses };
      } else if (userProcesses && userProcesses.length > 0) {
        query.process = { $in: userProcesses };
      }
      if (filterModels.length > 0) {
        query.model = { $in: filterModels };
      }
      const codes = await EmailImage.distinct('code', query);
      return codes.sort();
    }
    // Local: in-memory distinct
    const images = await storage.listImages();
    const filtered = _filterImages(images, { process: processFilter, model: modelFilter, userProcesses });
    const codes = [...new Set(filtered.map(img => img.code).filter(Boolean))];
    return codes.sort();
  } catch (error) {
    console.error('getDistinctCodes error:', error);
    return [];
  }
}

/**
 * Get distinct subcodes filtered by process, model, and code
 */
async function getDistinctSubcodes(processFilter, modelFilter, codeFilter, userProcesses) {
  try {
    if (IS_MONGODB_STORAGE) {
      const query = { subcode: { $ne: '' } };
      const filterProcesses = _parseCommaSeparated(processFilter);
      const filterModels = _parseCommaSeparated(modelFilter);
      const filterCodes = _parseCommaSeparated(codeFilter);
      if (filterProcesses.length > 0) {
        query.process = { $in: filterProcesses };
      } else if (userProcesses && userProcesses.length > 0) {
        query.process = { $in: userProcesses };
      }
      if (filterModels.length > 0) {
        query.model = { $in: filterModels };
      }
      if (filterCodes.length > 0) {
        query.code = { $in: filterCodes };
      }
      const subcodes = await EmailImage.distinct('subcode', query);
      return subcodes.sort();
    }
    // Local: in-memory distinct
    const images = await storage.listImages();
    const filtered = _filterImages(images, { process: processFilter, model: modelFilter, code: codeFilter, userProcesses });
    const subcodes = [...new Set(filtered.map(img => img.subcode).filter(Boolean))];
    return subcodes.sort();
  } catch (error) {
    console.error('getDistinctSubcodes error:', error);
    return [];
  }
}

/**
 * List images with filters and pagination
 */
async function listImagesPaginated(filters = {}, paginationQuery = {}, req = null) {
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery);

  try {
    if (IS_MONGODB_STORAGE) {
      // MongoDB query
      const query = {};
      const filterProcesses = _parseCommaSeparated(filters.process);
      const filterModels = _parseCommaSeparated(filters.model);
      const filterCodes = _parseCommaSeparated(filters.code);
      const filterSubcodes = _parseCommaSeparated(filters.subcode);
      const userProcesses = filters.userProcesses || [];

      if (filterProcesses.length > 0) {
        query.process = { $in: filterProcesses };
      } else if (userProcesses.length > 0) {
        query.process = { $in: userProcesses };
      }
      if (filterModels.length > 0) {
        query.model = { $in: filterModels };
      }
      if (filterCodes.length > 0) {
        query.code = { $in: filterCodes };
      }
      if (filterSubcodes.length > 0) {
        query.subcode = { $in: filterSubcodes };
      }

      const [total, images] = await Promise.all([
        EmailImage.countDocuments(query),
        EmailImage.find(query)
          .select('-body')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      return {
        data: images.map(img => _formatImageWithUrl(img, req)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    }

    // Local: in-memory filtering + pagination
    const allImages = await storage.listImages();
    const filtered = _filterImages(allImages, filters);
    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      data: paginated.map(img => _formatImageWithUrl(img, req)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  } catch (error) {
    console.error('listImagesPaginated error:', error);
    return { data: [], total: 0, page, pageSize, totalPages: 0 };
  }
}

/**
 * Delete multiple images
 */
async function deleteMultipleImages(items) {
  let deleted = 0;
  for (const item of items) {
    const result = await deleteImage(item.prefix, item.name);
    if (result) deleted++;
  }
  return { deleted };
}

/**
 * Update image metadata (process, model, code, subcode)
 */
async function updateImageMetadata(currentPrefix, name, updates) {
  try {
    if (IS_MONGODB_STORAGE) {
      const existingImage = await EmailImage.findOne({ prefix: currentPrefix, name });
      if (!existingImage) return null;

      const newProcess = updates.process !== undefined ? updates.process : existingImage.process;
      const newModel = updates.model !== undefined ? updates.model : existingImage.model;
      const newCode = updates.code !== undefined ? updates.code : existingImage.code;
      const newSubcode = updates.subcode !== undefined ? updates.subcode : existingImage.subcode;
      const newPrefix = `ARS_${newProcess}_${newModel}_${newCode}_${newSubcode}`;

      existingImage.process = newProcess;
      existingImage.model = newModel;
      existingImage.code = newCode;
      existingImage.subcode = newSubcode;
      existingImage.prefix = newPrefix;
      await existingImage.save();

      return { prefix: newPrefix, name, process: newProcess, model: newModel, code: newCode, subcode: newSubcode };
    }

    // Local: delegate to storage
    if (storage.updateImageMetadata) {
      return await storage.updateImageMetadata(name, updates);
    }
    return null;
  } catch (error) {
    console.error('updateImageMetadata error:', error);
    throw error;
  }
}

/**
 * Update multiple images metadata
 */
async function updateMultipleImages(items) {
  let updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const { prefix, name, ...updates } = item;
      const result = await updateImageMetadata(prefix, name, updates);
      if (result) {
        updated++;
      } else {
        errors.push({ prefix, name, error: 'Image not found' });
      }
    } catch (error) {
      errors.push({ prefix: item.prefix, name: item.name, error: error.message });
    }
  }

  return { updated, errors };
}

module.exports = {
  initialize,
  uploadImage,
  getImage,
  deleteImage,
  listImages,
  getImageUrl,
  getEmailImageUrl,
  // Email Image page functions
  getDistinctProcesses,
  getDistinctModels,
  getDistinctCodes,
  getDistinctSubcodes,
  listImagesPaginated,
  deleteMultipleImages,
  updateImageMetadata,
  updateMultipleImages
};
