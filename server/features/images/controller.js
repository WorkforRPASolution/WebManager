const service = require('./service');
const { validateFile } = require('./validation');

// 파일명 UTF-8 디코딩 (multer는 Latin1로 전달)
function decodeFilename(filename) {
  try {
    // Latin1로 인코딩된 문자열을 Buffer로 변환 후 UTF-8로 디코딩
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch (error) {
    return filename;
  }
}

// 이미지 응답 헬퍼 함수 (코드 중복 제거)
function sendImageResponse(res, image) {
  if (!image) {
    return res.status(404).json({
      success: false,
      message: '이미지를 찾을 수 없습니다.'
    });
  }
  res.set('Content-Type', image.mimetype);
  res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
  res.send(image.buffer);
}

// 삭제 응답 헬퍼 함수 (코드 중복 제거)
function sendDeleteResponse(res, result) {
  if (!result) {
    return res.status(404).json({
      success: false,
      message: '이미지를 찾을 수 없습니다.'
    });
  }
  res.json({
    success: true,
    message: '이미지가 삭제되었습니다.'
  });
}

// 이미지 업로드
async function uploadImage(req, res) {
  try {
    const file = req.file;
    const prefix = req.body.prefix || 'DEFAULT';

    // 개별 필터 필드 추출
    const context = {
      process: req.body.process || '',
      model: req.body.model || '',
      code: req.body.code || '',
      subcode: req.body.subcode || ''
    };

    // 파일 검증
    const validation = validateFile(file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // 파일명 UTF-8 디코딩
    file.originalname = decodeFilename(file.originalname);

    // 이미지 업로드 (개별 필드 포함)
    const result = await service.uploadImage(file, prefix, context);
    const url = service.getImageUrl(result.prefix, result.name || result.id, req);
    const emailUrl = service.getEmailImageUrl(result.prefix, result.name || result.id);

    res.status(201).json({
      success: true,
      image: {
        id: result.name || result.id,
        prefix: result.prefix,
        name: result.name || result.id,
        process: result.process || '',
        model: result.model || '',
        code: result.code || '',
        subcode: result.subcode || '',
        filename: result.filename,
        mimetype: result.mimetype,
        size: result.size,
        createdAt: result.createdAt,
        url,
        emailUrl: emailUrl || url  // HttpWebServer URL (없으면 WebManager URL 사용)
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드에 실패했습니다.'
      // 보안: 내부 에러 메시지 노출 방지
    });
  }
}

// 이미지 조회 (by id only - for local storage backward compatibility)
async function getImage(req, res) {
  try {
    const { id } = req.params;
    // For local storage, prefix is not needed
    const image = await service.getImage(null, id);
    sendImageResponse(res, image);
  } catch (error) {
    console.error('Image get error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 조회에 실패했습니다.'
    });
  }
}

// 이미지 조회 (by prefix + name - for httpwebserver storage)
async function getImageByPrefixAndName(req, res) {
  try {
    const { prefix, name } = req.params;
    const image = await service.getImage(prefix, name);
    sendImageResponse(res, image);
  } catch (error) {
    console.error('Image get error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 조회에 실패했습니다.'
    });
  }
}

// 이미지 삭제 (by prefix + name)
async function deleteImage(req, res) {
  try {
    const { prefix, name } = req.params;
    const result = await service.deleteImage(prefix, name);
    sendDeleteResponse(res, result);
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제에 실패했습니다.'
    });
  }
}

// 이미지 삭제 (by id only - for local storage backward compatibility)
async function deleteImageById(req, res) {
  try {
    const { id } = req.params;
    // For local storage, prefix is not needed
    const result = await service.deleteImage(null, id);
    sendDeleteResponse(res, result);
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제에 실패했습니다.'
    });
  }
}

// 이미지 목록 조회
async function listImages(req, res) {
  try {
    const { prefix } = req.query;
    const images = await service.listImages(prefix);

    // URL 추가 (썸네일용 url + 이메일용 emailUrl)
    const imagesWithUrl = images.map(img => {
      const url = service.getImageUrl(img.prefix, img.name || img.id, req);
      const emailUrl = service.getEmailImageUrl(img.prefix, img.name || img.id);
      return {
        id: img.name || img.id,
        prefix: img.prefix,
        name: img.name || img.id,
        filename: img.filename,
        mimetype: img.mimetype,
        size: img.size,
        createdAt: img.createdAt,
        url,
        emailUrl: emailUrl || url  // HttpWebServer URL (없으면 WebManager URL 사용)
      };
    });

    res.json({
      success: true,
      images: imagesWithUrl
    });
  } catch (error) {
    console.error('Image list error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회에 실패했습니다.'
    });
  }
}

// === NEW: Email Image Page API functions ===

// Get distinct processes from image prefixes
async function getProcesses(req, res) {
  try {
    const processes = await service.getDistinctProcesses();
    res.json(processes);
  } catch (error) {
    console.error('Get processes error:', error);
    res.status(500).json({
      success: false,
      message: 'Process 목록 조회에 실패했습니다.'
    });
  }
}

// Get distinct models filtered by process
async function getModels(req, res) {
  try {
    const { process: processFilter, userProcesses: userProcessesStr } = req.query;
    const userProcesses = userProcessesStr
      ? userProcessesStr.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const models = await service.getDistinctModels(processFilter, userProcesses);
    res.json(models);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: 'Model 목록 조회에 실패했습니다.'
    });
  }
}

// Get distinct codes filtered by process and model
async function getCodes(req, res) {
  try {
    const { process: processFilter, model: modelFilter, userProcesses: userProcessesStr } = req.query;
    const userProcesses = userProcessesStr
      ? userProcessesStr.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const codes = await service.getDistinctCodes(processFilter, modelFilter, userProcesses);
    res.json(codes);
  } catch (error) {
    console.error('Get codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Code 목록 조회에 실패했습니다.'
    });
  }
}

// Get distinct subcodes filtered by process, model, and code
async function getSubcodes(req, res) {
  try {
    const { process: processFilter, model: modelFilter, code: codeFilter, userProcesses: userProcessesStr } = req.query;
    const userProcesses = userProcessesStr
      ? userProcessesStr.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const subcodes = await service.getDistinctSubcodes(processFilter, modelFilter, codeFilter, userProcesses);
    res.json(subcodes);
  } catch (error) {
    console.error('Get subcodes error:', error);
    res.status(500).json({
      success: false,
      message: 'Subcode 목록 조회에 실패했습니다.'
    });
  }
}

// List images with pagination and filters
async function listImagesPaginated(req, res) {
  try {
    const { process, model, code, subcode, userProcesses: userProcessesStr, page, pageSize } = req.query;

    const userProcesses = userProcessesStr
      ? userProcessesStr.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const filters = { process, model, code, subcode, userProcesses };
    const paginationQuery = { page, pageSize };

    const result = await service.listImagesPaginated(filters, paginationQuery, req);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('List images paginated error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회에 실패했습니다.'
    });
  }
}

// Delete multiple images
async function deleteMultipleImages(req, res) {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '삭제할 이미지 목록이 필요합니다.'
      });
    }

    const result = await service.deleteMultipleImages(items);

    res.json({
      success: true,
      deleted: result.deleted,
      message: `${result.deleted}개의 이미지가 삭제되었습니다.`
    });
  } catch (error) {
    console.error('Delete multiple images error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제에 실패했습니다.'
    });
  }
}

// Update multiple images metadata
async function updateMultipleImages(req, res) {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 이미지 목록이 필요합니다.'
      });
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.prefix || !item.name) {
        return res.status(400).json({
          success: false,
          message: '각 항목에는 prefix와 name이 필요합니다.'
        });
      }
    }

    const result = await service.updateMultipleImages(items);

    res.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
      message: `${result.updated}개의 이미지가 수정되었습니다.`
    });
  } catch (error) {
    console.error('Update multiple images error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 수정에 실패했습니다.'
    });
  }
}

module.exports = {
  uploadImage,
  getImage,
  getImageByPrefixAndName,
  deleteImage,
  deleteImageById,
  listImages,
  // New functions for Email Image page
  getProcesses,
  getModels,
  getCodes,
  getSubcodes,
  listImagesPaginated,
  deleteMultipleImages,
  updateMultipleImages
};
