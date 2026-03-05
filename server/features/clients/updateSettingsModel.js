/**
 * Update Settings Model
 * UPDATE_SETTINGS - Manages software update settings per agentGroup
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const taskSchema = new Schema({
  taskId: { type: String, required: true },
  type: { type: String, enum: ['copy', 'exec'], default: 'copy' },
  name: { type: String, required: true, trim: true },
  sourcePath: { type: String, default: '', trim: true },
  targetPath: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
  stopOnFail: { type: Boolean, default: false },
  commandLine: { type: String, default: '', trim: true },
  args: { type: [String], default: undefined },
  timeout: { type: Number, default: 30000 }
}, { _id: false })

const profileSchema = new Schema({
  profileId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  osVer: { type: String, default: '', trim: true },
  version: { type: String, default: '', trim: true },
  tasks: [taskSchema],
  source: { type: Schema.Types.Mixed, default: () => ({ type: 'local' }) }
}, { _id: false })

const updateSettingsSchema = new Schema({
  agentGroup: { type: String, required: true, unique: true, trim: true },
  profiles: [profileSchema],
  packages: { type: [Schema.Types.Mixed], default: undefined },
  source: { type: Schema.Types.Mixed, default: () => ({ type: 'local' }) },
  updatedBy: { type: String, default: 'system' }
}, {
  collection: 'UPDATE_SETTINGS',
  timestamps: true
})

module.exports = webManagerConnection.model('UpdateSettings', updateSettingsSchema)
