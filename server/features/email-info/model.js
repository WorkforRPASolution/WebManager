/**
 * EmailInfo Model
 * EMAILINFO - Email category and recipient information
 */

const mongoose = require('mongoose')

const emailInfoSchema = new mongoose.Schema({
  project: {
    type: String,
    required: true,
    trim: true,
    default: 'ARS'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  account: {
    type: [String],
    default: []
  },
  departments: {
    type: [String],
    default: []
  }
}, {
  collection: 'EMAILINFO',
  timestamps: false
})

// Compound index for PK (project + category)
emailInfoSchema.index({ project: 1, category: 1 }, { unique: true })

// Index for queries
emailInfoSchema.index({ project: 1 })
emailInfoSchema.index({ category: 1 })

const EmailInfo = mongoose.model('EmailInfo', emailInfoSchema)

module.exports = EmailInfo
