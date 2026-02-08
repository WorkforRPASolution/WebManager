/**
 * Config Settings Model
 * CONFIG_SETTINGS - Manages config file settings per agentGroup
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const configFileSchema = new Schema({
  fileId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  path: { type: String, required: true, trim: true }
}, { _id: false })

const configSettingsSchema = new Schema({
  agentGroup: { type: String, required: true, unique: true, trim: true },
  configFiles: [configFileSchema],
  updatedBy: { type: String, default: 'system' }
}, {
  collection: 'CONFIG_SETTINGS',
  timestamps: true
})

module.exports = webManagerConnection.model('ConfigSettings', configSettingsSchema)
