const storage = require('./storage');

// 모듈 레벨 상수 (매 함수 호출마다 읽지 않도록 최적화)
const STORAGE_TYPE = process.env.IMAGE_STORAGE || 'local';

// 스토리지 초기화
async function initialize() {
  await storage.initialize();
}

// 이미지 업로드
async function uploadImage(file, prefix) {
  const storageType = STORAGE_TYPE;

  if (storageType === 'httpwebserver') {
    // HttpWebServer storage uses prefix
    const result = await storage.uploadImage(file, prefix);
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

module.exports = {
  initialize,
  uploadImage,
  getImage,
  deleteImage,
  listImages,
  getImageUrl,
  getEmailImageUrl
};
