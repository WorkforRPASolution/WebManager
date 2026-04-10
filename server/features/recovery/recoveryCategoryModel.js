/**
 * RECOVERY_CATEGORY_MAP — Mongoose Model
 * Maps SC_PROPERTY.scCategory (NumberLong) to a human-readable category name.
 * Stored in WEB_MANAGER DB, managed by Admin via dashboard modal.
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

// SC_PROPERTY.scCategory가 NumberLong이므로 타입 일치를 위해 Mixed 사용
const recoveryCategorySchema = new Schema({
  scCategory: {
    type: Schema.Types.Mixed,
    required: true,
    unique: true
  },
  categoryName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  updatedBy: {
    type: String,
    trim: true,
    default: 'system'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'RECOVERY_CATEGORY_MAP',
  timestamps: false
})

const RecoveryCategoryMap = webManagerConnection.model('RecoveryCategoryMap', recoveryCategorySchema)

module.exports = RecoveryCategoryMap
