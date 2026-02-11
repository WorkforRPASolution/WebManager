/**
 * Update Settings Model
 * UPDATE_SETTINGS - Manages software update settings per agentGroup
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const packageSchema = new Schema({
  packageId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  targetPath: { type: String, required: true, trim: true },
  targetType: { type: String, enum: ['file', 'directory'], default: 'file' },
  description: { type: String, default: '', trim: true }
}, { _id: false })

const sourceSchema = new Schema({
  type: { type: String, enum: ['local', 'ftp', 'minio'], default: 'local' },
  localPath: { type: String, default: '', trim: true },
  ftpHost: { type: String, default: '', trim: true },
  ftpPort: { type: Number, default: 21 },
  ftpUser: { type: String, default: '', trim: true },
  ftpPass: { type: String, default: '', trim: true },
  ftpBasePath: { type: String, default: '', trim: true },
  minioEndpoint: { type: String, default: '', trim: true },
  minioPort: { type: Number },
  minioBucket: { type: String, default: '', trim: true },
  minioAccessKey: { type: String, default: '', trim: true },
  minioSecretKey: { type: String, default: '', trim: true },
  minioUseSSL: { type: Boolean, default: false },
  minioBasePath: { type: String, default: '', trim: true }
}, { _id: false })

const updateSettingsSchema = new Schema({
  agentGroup: { type: String, required: true, unique: true, trim: true },
  packages: [packageSchema],
  source: { type: sourceSchema, default: () => ({}) },
  updatedBy: { type: String, default: 'system' }
}, {
  collection: 'UPDATE_SETTINGS',
  timestamps: true
})

module.exports = webManagerConnection.model('UpdateSettings', updateSettingsSchema)
