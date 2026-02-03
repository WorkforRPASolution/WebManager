const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { upload } = require('./validation');

// 이미지 업로드 (POST /api/images)
// Body: file (multipart), prefix (string)
router.post('/', upload.single('file'), controller.uploadImage);

// 이미지 목록 조회 (GET /api/images?prefix=xxx)
router.get('/', controller.listImages);

// 이미지 조회 (GET /api/images/:prefix/:name) - 인증 없이 접근 가능
// For httpwebserver storage
router.get('/:prefix/:name', controller.getImageByPrefixAndName);

// 이미지 조회 (GET /api/images/:id) - 인증 없이 접근 가능
// For local storage backward compatibility
router.get('/:id', controller.getImage);

// 이미지 삭제 (DELETE /api/images/:prefix/:name)
// For httpwebserver storage
router.delete('/:prefix/:name', controller.deleteImage);

// 이미지 삭제 (DELETE /api/images/:id)
// For local storage backward compatibility
router.delete('/:id', controller.deleteImageById);

module.exports = router;
