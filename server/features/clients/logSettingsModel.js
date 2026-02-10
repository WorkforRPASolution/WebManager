/**
 * Log Settings Model
 * LOG_SETTINGS - Manages log source settings per agentGroup
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const logSourceSchema = new Schema({
  sourceId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  path: { type: String, required: true, trim: true },
  keyword: { type: String, required: true, trim: true }
}, { _id: false })

const logSettingsSchema = new Schema({
  agentGroup: { type: String, required: true, unique: true, trim: true },
  logSources: [logSourceSchema],
  updatedBy: { type: String, default: 'system' }
}, {
  collection: 'LOG_SETTINGS',
  timestamps: true
})

module.exports = webManagerConnection.model('LogSettings', logSettingsSchema)
