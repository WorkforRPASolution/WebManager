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

// 이미지 업로드
async function uploadImage(req, res) {
  try {
    const file = req.file;
    const prefix = req.body.prefix || 'DEFAULT';

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

    // 이미지 업로드
    const result = await service.uploadImage(file, prefix);
    const url = service.getImageUrl(result.prefix, result.name || result.id, req);
    const emailUrl = service.getEmailImageUrl(result.prefix, result.name || result.id);

    res.status(201).json({
      success: true,
      image: {
        id: result.name || result.id,
        prefix: result.prefix,
        name: result.name || result.id,
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
      message: '이미지 업로드에 실패했습니다.',
      error: error.message
    });
  }
}

// 이미지 조회 (by id only - for local storage backward compatibility)
async function getImage(req, res) {
  try {
    const { id } = req.params;
    // For local storage, prefix is not needed
    const image = await service.getImage(null, id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    res.set('Content-Type', image.mimetype);
    res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.send(image.buffer);
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

    if (!image) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    res.set('Content-Type', image.mimetype);
    res.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.send(image.buffer);
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

module.exports = {
  uploadImage,
  getImage,
  getImageByPrefixAndName,
  deleteImage,
  deleteImageById,
  listImages
};
