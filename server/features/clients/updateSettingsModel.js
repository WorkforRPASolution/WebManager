/**
 * Update Settings Model
 * UPDATE_SETTINGS - 1 document = 1 profile.
 * Composite primary key: (agentGroup, profileId).
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

const updateProfileSchema = new Schema({
  agentGroup: { type: String, required: true, trim: true },
  profileId: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  osVer: { type: String, default: '', trim: true },
  version: { type: String, default: '', trim: true },
  tasks: { type: [taskSchema], default: [] },
  source: { type: Schema.Types.Mixed, default: () => ({ type: 'local' }) },
  updatedBy: { type: String, default: 'system' }
}, {
  collection: 'UPDATE_SETTINGS',
  timestamps: true
})

// User-identifier unique: what the operator sees in the UpdateModal dropdown
// (`{name} ({osVer||'All OS'}) v{version}`). Prevents two profiles from rendering
// as identical lines. Leftmost-prefix covers { agentGroup } queries too.
updateProfileSchema.index(
  { agentGroup: 1, name: 1, osVer: 1, version: 1 },
  { unique: true, name: 'agentGroup_name_osVer_version_unique' }
)
// Lookup index for REST URL / audit documentId (profileId is a stable UUID).
updateProfileSchema.index({ agentGroup: 1, profileId: 1 })

module.exports = webManagerConnection.model('UpdateSettings', updateProfileSchema)
module.exports.taskSchema = taskSchema
