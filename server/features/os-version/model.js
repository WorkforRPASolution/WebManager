/**
 * OS Version Model
 * OS_VERSION_LIST - Manages available OS versions for equipment info
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const osVersionSchema = new Schema({
  version: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  collection: 'OS_VERSION_LIST',
  timestamps: true
})

// Indexes (version index already created by unique: true)
osVersionSchema.index({ active: 1 })

module.exports = webManagerConnection.model('OSVersion', osVersionSchema)
