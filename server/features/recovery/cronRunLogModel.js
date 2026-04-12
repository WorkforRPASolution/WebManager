/**
 * Cron Run Log Model
 * CRON_RUN_LOG - Tracks batch job execution history
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

const cronRunLogSchema = new Schema({
  jobName: { type: String, required: true },
  period: { type: String, enum: ['hourly', 'daily'], required: true },
  bucket: { type: Date, required: true },
  status: { type: String, enum: ['success', 'partial', 'failed', 'running'] }, // 'running' reserved for future distributed lock
  startedAt: { type: Date },
  completedAt: { type: Date },
  pipelineResults: {
    type: Map,
    of: String,
    default: undefined
  },
  errorMessage: [{ configKey: String, error: String, _id: false }],
  source: {
    type: String,
    enum: ['cron', 'autoBackfill', 'manualBackfill'],
    default: 'cron'
  }
}, {
  collection: 'CRON_RUN_LOG',
  timestamps: false
})

module.exports = webManagerConnection.model('CronRunLog', cronRunLogSchema)
