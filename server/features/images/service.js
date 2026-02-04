const storage = require('./storage');
const EmailImage = require('./model');
const { parsePaginationParams } = require('../../shared/utils/pagination');

// 모듈 레벨 상수 (매 함수 호출마다 읽지 않도록 최적화)
const STORAGE_TYPE = process.env.IMAGE_STORAGE || 'local';

// 스토리지 초기화
async function initialize() {
  await storage.initialize();
}

// 이미지 업로드
async function uploadImage(file, prefix, context = {}) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer storage uses prefix and context
    const result = await storage.uploadImage(file, prefix, context);
    return result;
  }

  // Local storage (backward compatible)
  const result = await storage.uploadImage(file);
  return { ...result, prefix };
}

// 이미지 조회
async function getImage(prefix, name) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer storage uses prefix + name
    const image = await storage.getImage(prefix, name);
    return image;
  }

  // Local storage uses id (name) only
  const image = await storage.getImage(name);
  return image;
}

// 이미지 삭제
async function deleteImage(prefix, name) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer storage uses prefix + name
    const result = await storage.deleteImage(prefix, name);
    return result;
  }

  // Local storage uses id (name) only
  const result = await storage.deleteImage(name);
  return result;
}

// 이미지 목록 조회
async function listImages(prefix) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer storage filters by prefix
    const images = await storage.listImages(prefix);
    return images;
  }

  // Local storage returns all images (no prefix filtering)
  const images = await storage.listImages();
  return images;
}

// 이미지 URL 생성 (프론트엔드 썸네일용 - WebManager API)
function getImageUrl(prefix, name, req) {
  const storageType = STORAGE_TYPE;
  const protocol = req.protocol;
  const host = req.get('host');

  if (storageType === 'httpwebserver') {
    // WebManager API URL (프론트엔드용)
    return `${protocol}://${host}/api/images/${encodeURIComponent(prefix)}/${name}`;
  }

  // 로컬: WebManager API로 제공 (backward compatible with id-only path)
  return `${protocol}://${host}/api/images/${name}`;
}

// 이메일용 이미지 URL 생성 (HttpWebServer 직접 접근)
function getEmailImageUrl(prefix, name) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer URL (이메일 클라이언트에서 직접 접근)
    return storage.getImageUrl(prefix, name);
  }

  // 로컬 스토리지는 이메일용 URL을 지원하지 않음 (외부 접근 불가)
  return null;
}

/**
 * Get distinct processes from image records using MongoDB distinct
 * @returns {Promise<string[]>} List of distinct processes
 */
async function getDistinctProcesses() {
  try {
    const processes = await EmailImage.distinct('process', { process: { $ne: '' } });
    return processes.sort();
  } catch (error) {
    console.error('getDistinctProcesses error:', error);
    return [];
  }
}

/**
 * Get distinct models filtered by process using MongoDB distinct
 * @param {string} processFilter - Comma-separated processes to filter by
 * @param {string[]} userProcesses - User's process permissions
 * @returns {Promise<string[]>} List of distinct models
 */
async function getDistinctModels(processFilter, userProcesses) {
  try {
    const query = { model: { $ne: '' } };

    const filterProcesses = processFilter
      ? processFilter.split(',').map(p => p.trim()).filter(p => p)
      : [];

    if (filterProcesses.length > 0) {
      query.process = { $in: filterProcesses };
    } else if (userProcesses && userProcesses.length > 0) {
      query.process = { $in: userProcesses };
    }

    const models = await EmailImage.distinct('model', query);
    return models.sort();
  } catch (error) {
    console.error('getDistinctModels error:', error);
    return [];
  }
}

/**
 * Get distinct codes filtered by process and model using MongoDB distinct
 * @param {string} processFilter - Comma-separated processes to filter by
 * @param {string} modelFilter - Comma-separated models to filter by
 * @param {string[]} userProcesses - User's process permissions
 * @returns {Promise<string[]>} List of distinct codes
 */
async function getDistinctCodes(processFilter, modelFilter, userProcesses) {
  try {
    const query = { code: { $ne: '' } };

    const filterProcesses = processFilter
      ? processFilter.split(',').map(p => p.trim()).filter(p => p)
      : [];
    const filterModels = modelFilter
      ? modelFilter.split(',').map(m => m.trim()).filter(m => m)
      : [];

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
  } catch (error) {
    console.error('getDistinctCodes error:', error);
    return [];
  }
}

/**
 * Get distinct subcodes filtered by process, model, and code using MongoDB distinct
 * @param {string} processFilter - Comma-separated processes to filter by
 * @param {string} modelFilter - Comma-separated models to filter by
 * @param {string} codeFilter - Comma-separated codes to filter by
 * @param {string[]} userProcesses - User's process permissions
 * @returns {Promise<string[]>} List of distinct subcodes
 */
async function getDistinctSubcodes(processFilter, modelFilter, codeFilter, userProcesses) {
  try {
    const query = { subcode: { $ne: '' } };

    const filterProcesses = processFilter
      ? processFilter.split(',').map(p => p.trim()).filter(p => p)
      : [];
    const filterModels = modelFilter
      ? modelFilter.split(',').map(m => m.trim()).filter(m => m)
      : [];
    const filterCodes = codeFilter
      ? codeFilter.split(',').map(c => c.trim()).filter(c => c)
      : [];

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
  } catch (error) {
    console.error('getDistinctSubcodes error:', error);
    return [];
  }
}

/**
 * List images with filters and pagination using MongoDB query
 * @param {Object} filters - { process, model, code, subcode, userProcesses }
 * @param {Object} paginationQuery - { page, pageSize }
 * @param {Object} req - Express request for URL generation
 * @returns {Promise<Object>} Paginated result
 */
async function listImagesPaginated(filters = {}, paginationQuery = {}, req = null) {
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery);

  // Build MongoDB query
  const query = {};

  const filterProcesses = filters.process
    ? filters.process.split(',').map(p => p.trim()).filter(p => p)
    : [];
  const filterModels = filters.model
    ? filters.model.split(',').map(m => m.trim()).filter(m => m)
    : [];
  const filterCodes = filters.code
    ? filters.code.split(',').map(c => c.trim()).filter(c => c)
    : [];
  const filterSubcodes = filters.subcode
    ? filters.subcode.split(',').map(s => s.trim()).filter(s => s)
    : [];
  const userProcesses = filters.userProcesses || [];

  // Filter by process
  if (filterProcesses.length > 0) {
    query.process = { $in: filterProcesses };
  } else if (userProcesses.length > 0) {
    query.process = { $in: userProcesses };
  }

  // Filter by model
  if (filterModels.length > 0) {
    query.model = { $in: filterModels };
  }

  // Filter by code
  if (filterCodes.length > 0) {
    query.code = { $in: filterCodes };
  }

  // Filter by subcode
  if (filterSubcodes.length > 0) {
    query.subcode = { $in: filterSubcodes };
  }

  try {
    // Get total count and paginated data in parallel
    const [total, images] = await Promise.all([
      EmailImage.countDocuments(query),
      EmailImage.find(query)
        .select('-body')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    // Add URL and format response
    const imagesWithUrl = images.map(img => {
      const url = req ? getImageUrl(img.prefix, img.name, req) : null;
      const emailUrl = getEmailImageUrl(img.prefix, img.name);

      return {
        id: img.name,
        prefix: img.prefix,
        name: img.name,
        filename: img.fileName,
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
    });

    return {
      data: imagesWithUrl,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  } catch (error) {
    console.error('listImagesPaginated error:', error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0
    };
  }
}

/**
 * Delete multiple images
 * @param {Array<{prefix: string, name: string}>} items - Images to delete
 * @returns {Promise<{deleted: number}>}
 */
async function deleteMultipleImages(items) {
  let deleted = 0;

  for (const item of items) {
    const result = await deleteImage(item.prefix, item.name);
    if (result) deleted++;
  }

  return { deleted };
}

module.exports = {
  initialize,
  uploadImage,
  getImage,
  deleteImage,
  listImages,
  getImageUrl,
  getEmailImageUrl,
  // New functions for Email Image page
  getDistinctProcesses,
  getDistinctModels,
  getDistinctCodes,
  getDistinctSubcodes,
  listImagesPaginated,
  deleteMultipleImages
};
