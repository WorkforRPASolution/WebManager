/**
 * HttpWebServer Storage Implementation
 *
 * 아키텍처 (v2 - MongoDB 직접 저장):
 *   - 업로드/삭제: WebManager → MongoDB 직접
 *   - 목록 조회: WebManager → MongoDB 직접
 *   - 이미지 조회 (Java Client): HttpWebServer → MongoDB (Java 1.6 HTTP 호환)
 *
 * HttpWebServer URL은 이메일용 이미지 URL 생성에만 사용됨
 */

const { v4: uuidv4 } = require('uuid');
const EmailImage = require('../model');

// 이메일용 이미지 URL 경로 (HttpWebServer가 @HttpWebServerAddress를 실제 IP:PORT로 치환)
const BASE_PATH = '/ARS/EmailImage';

/**
 * Initialize storage
 */
async function initialize() {
  console.log(`  + HttpWebServer image storage initialized (MongoDB direct mode)`);
  console.log(`  + Image URL pattern: http://@HttpWebServerAddress${BASE_PATH}/{prefix}/{name}`);
}

/**
 * Upload image directly to MongoDB
 * @param {Object} file - Multer file object { buffer, originalname, mimetype, size }
 * @param {string} prefix - Image prefix (e.g., ARS_CVD_MODEL1_CODE1_SUBCODE1)
 * @param {Object} context - Filter fields { process, model, code, subcode }
 * @returns {Object} Image metadata
 */
async function uploadImage(file, prefix, context = {}) {
  const name = uuidv4();

  // MongoDB에 직접 저장 (fileName, body, 개별 필터 필드 포함)
  const imageDoc = new EmailImage({
    prefix,
    name,
    process: context.process || '',
    model: context.model || '',
    code: context.code || '',
    subcode: context.subcode || '',
    fileName: file.originalname,  // camelCase (DB 스키마)
    body: file.buffer,            // 바이너리 데이터
    mimetype: file.mimetype,
    size: file.size,
    createdAt: new Date()
  });

  await imageDoc.save();

  return {
    id: name,
    prefix,
    name,
    process: context.process || '',
    model: context.model || '',
    code: context.code || '',
    subcode: context.subcode || '',
    filename: file.originalname,  // API 응답은 lowercase (프론트엔드 호환)
    mimetype: file.mimetype,
    size: file.size,
    createdAt: imageDoc.createdAt.toISOString()
  };
}

/**
 * Get image directly from MongoDB
 * @param {string} prefix - Image prefix
 * @param {string} name - Image name (UUID)
 * @returns {Object|null} { buffer, mimetype } or null if not found
 */
async function getImage(prefix, name) {
  try {
    const image = await EmailImage.findOne({ prefix, name }).lean();

    if (!image || !image.body) {
      return null;
    }

    return {
      buffer: image.body.buffer || image.body,  // Buffer 또는 BinData 처리
      mimetype: image.mimetype || 'application/octet-stream'
    };
  } catch (error) {
    console.error('getImage error:', error);
    return null;
  }
}

/**
 * Delete image directly from MongoDB
 * @param {string} prefix - Image prefix
 * @param {string} name - Image name (UUID)
 * @returns {boolean} Success status
 */
async function deleteImage(prefix, name) {
  try {
    const result = await EmailImage.deleteOne({ prefix, name });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('deleteImage error:', error);
    return false;
  }
}

/**
 * List images by prefix from DB (without body for performance)
 * @param {string} prefix - Image prefix to filter by
 * @returns {Array} List of image metadata
 */
async function listImages(prefix) {
  try {
    const query = prefix ? { prefix } : {};
    const images = await EmailImage.find(query)
      .select('-body')  // body 필드 제외 (성능 최적화)
      .sort({ createdAt: -1 })
      .lean();

    return images.map(img => ({
      id: img.name,
      prefix: img.prefix,
      name: img.name,
      process: img.process || '',
      model: img.model || '',
      code: img.code || '',
      subcode: img.subcode || '',
      filename: img.fileName,  // DB: fileName → API: filename (프론트엔드 호환)
      mimetype: img.mimetype,
      size: img.size,
      createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt
    }));
  } catch (error) {
    console.error('listImages error:', error);
    return [];
  }
}

/**
 * Generate HttpWebServer image URL (for email clients / Java 1.6)
 * @param {string} prefix - Image prefix
 * @param {string} name - Image name (UUID)
 * @returns {string} Full URL to the image via HttpWebServer
 *
 * @HttpWebServerAddress: HttpWebServer가 이메일 발송 시 IP:PORT로 치환 (예: 127.0.0.1:8000)
 * 이를 통해 HttpWebServer URL 변경 시에도 기존 템플릿 호환성 유지
 */
function getImageUrl(prefix, name) {
  return `http://@HttpWebServerAddress${BASE_PATH}/${encodeURIComponent(prefix)}/${name}`;
}

module.exports = {
  initialize,
  uploadImage,
  getImage,
  deleteImage,
  listImages,
  getImageUrl
};
