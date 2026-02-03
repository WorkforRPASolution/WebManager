const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/images');
const METADATA_FILE = path.join(UPLOAD_DIR, 'metadata.json');

// UUID v4 형식 검증 정규식 (Path Traversal 방지)
const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

// MIME 타입 매핑 (중복 제거)
const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

// 메타데이터 읽기
async function readMetadata() {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// 메타데이터 저장
async function writeMetadata(metadata) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
}

// 디렉토리 초기화
async function initialize() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  console.log('  + Local image storage initialized:', UPLOAD_DIR);
}

// 이미지 업로드
async function uploadImage(file) {
  const id = uuidv4();
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${id}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, file.buffer);

  // 메타데이터 저장 (원본 파일명 보존)
  const metadata = await readMetadata();
  metadata[id] = {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    createdAt: new Date().toISOString()
  };
  await writeMetadata(metadata);

  return {
    id,
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    createdAt: metadata[id].createdAt
  };
}

// 이미지 조회 (버퍼 반환)
async function getImage(id) {
  try {
    // Path Traversal 방지: UUID 형식 검증
    if (!UUID_REGEX.test(id)) {
      console.warn('Invalid image ID format:', id);
      return null;
    }

    const files = await fs.readdir(UPLOAD_DIR);
    const file = files.find(f => f.startsWith(id) && f !== 'metadata.json');
    if (!file) return null;

    const filepath = path.join(UPLOAD_DIR, file);
    const buffer = await fs.readFile(filepath);
    const ext = path.extname(file).slice(1).toLowerCase();

    return {
      buffer,
      mimetype: MIME_TYPES[ext] || 'application/octet-stream'
    };
  } catch (error) {
    console.error('getImage error:', error);
    return null;
  }
}

// 이미지 삭제
async function deleteImage(id) {
  // Path Traversal 방지: UUID 형식 검증
  if (!UUID_REGEX.test(id)) {
    console.warn('Invalid image ID format for deletion:', id);
    return false;
  }

  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const file = files.find(f => f.startsWith(id) && f !== 'metadata.json');
    if (file) {
      await fs.unlink(path.join(UPLOAD_DIR, file));

      // 메타데이터에서 삭제
      const metadata = await readMetadata();
      delete metadata[id];
      await writeMetadata(metadata);

      return true;
    }
    return false;
  } catch (error) {
    console.error('deleteImage error:', error);
    return false;
  }
}

// 이미지 목록
async function listImages() {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const metadata = await readMetadata();
    const images = [];

    for (const file of files) {
      // metadata.json 파일 제외
      if (file === 'metadata.json') continue;

      const filepath = path.join(UPLOAD_DIR, file);
      const stat = await fs.stat(filepath);
      const ext = path.extname(file).slice(1).toLowerCase();
      const id = file.split('.')[0];

      // 메타데이터에서 원본 파일명 가져오기
      const meta = metadata[id] || {};

      images.push({
        id,
        filename: meta.originalName || file,
        mimetype: meta.mimetype || MIME_TYPES[ext] || 'application/octet-stream',
        size: meta.size || stat.size,
        createdAt: meta.createdAt || stat.birthtime.toISOString()
      });
    }

    // 최신순 정렬
    return images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('listImages error:', error);
    return [];
  }
}

module.exports = { initialize, uploadImage, getImage, deleteImage, listImages };
