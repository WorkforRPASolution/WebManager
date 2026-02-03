const multer = require('multer');

// 허용되는 이미지 타입
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// 최대 파일 크기 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_MIME_TYPES.join(', ')})`), false);
    }
  }
});

// 파일 검증
function validateFile(file) {
  if (!file) {
    return { valid: false, error: '파일이 제공되지 않았습니다.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: `허용되지 않는 파일 형식입니다. (허용: JPG, PNG, GIF, WebP)` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `파일 크기가 너무 큽니다. (최대: 5MB)` };
  }

  return { valid: true };
}

module.exports = {
  upload,
  validateFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
