/**
 * EmailRecipients Model
 * EMAIL_RECIPIENTS - Scenario execution result email routing by category
 *
 * Database: EARS (shared with Akka server)
 */

const { Schema } = require('mongoose')
const { earsConnection } = require('../../shared/db/connection')

const emailRecipientsSchema = new Schema({
  app: {
    type: String,
    required: true,
    trim: true,
    default: 'ARS'
  },
  line: {
    type: String,
    required: true,
    trim: true
  },
  process: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true
  },
  emailCategory: {
    type: String,
    required: true,
    trim: true
  }
}, {
  collection: 'EMAIL_RECIPIENTS',
  timestamps: false
})

// Compound unique index for PK (app + line + process + model + code)
emailRecipientsSchema.index(
  { app: 1, line: 1, process: 1, model: 1, code: 1 },
  { unique: true }
)

// Indexes for common queries
emailRecipientsSchema.index({ app: 1 })
emailRecipientsSchema.index({ line: 1 })
emailRecipientsSchema.index({ process: 1 })
emailRecipientsSchema.index({ model: 1 })
emailRecipientsSchema.index({ code: 1 })

const EmailRecipients = earsConnection.model('EmailRecipients', emailRecipientsSchema)

module.exports = EmailRecipients
