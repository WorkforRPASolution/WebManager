/**
 * EMAIL_IMAGE_REPOSITORY Model
 * Stores image binary and metadata directly in MongoDB
 * Uses EARS database connection (shared with Akka server)
 *
 * DB Schema (EARS.EMAIL_IMAGE_REPOSITORY):
 *   - prefix: String (PK) - URL용 (기존 호환성), format: ARS_[process]_[model]_[code]_[subcode]
 *   - name: String (PK) - UUID
 *   - process: String - 프로세스 (필터용 개별 필드)
 *   - model: String - 모델 (필터용 개별 필드)
 *   - code: String - 코드 (필터용 개별 필드)
 *   - subcode: String - 서브코드 (필터용 개별 필드)
 *   - fileName: String - 원본 파일명 (camelCase, required)
 *   - body: BinData - 이미지 바이너리 (required)
 *   - mimetype, size, createdAt: WebManager 전용 메타데이터
 */

const mongoose = require('mongoose');
const { earsConnection } = require('../../shared/db/connection');

const emailImageSchema = new mongoose.Schema({
  prefix: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  // 필터용 개별 필드 (prefix 파싱 문제 해결)
  process: {
    type: String,
    default: '',
    index: true
  },
  model: {
    type: String,
    default: '',
    index: true
  },
  code: {
    type: String,
    default: '',
    index: true
  },
  subcode: {
    type: String,
    default: ''
  },
  // DB 스키마 필드 (EARS DB와 공유)
  fileName: {
    type: String,
    required: true
  },
  body: {
    type: Buffer,
    required: true
  },
  // WebManager 전용 메타데이터 (편의 제공)
  mimetype: {
    type: String
  },
  size: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'EMAIL_IMAGE_REPOSITORY'
});

// Compound unique index for prefix + name
emailImageSchema.index({ prefix: 1, name: 1 }, { unique: true });

// Compound index for filtering by process, model, code, subcode
emailImageSchema.index({ process: 1, model: 1, code: 1, subcode: 1 });

const EmailImage = earsConnection.model('EmailImage', emailImageSchema);

module.exports = EmailImage;
