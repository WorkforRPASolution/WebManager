/**
 * Email Template Model
 * EMAIL_TEMPLATE_REPOSITORY - Email templates
 *
 * Database: EARS (shared with Akka server)
 */

const { Schema } = require('mongoose');
const { earsConnection } = require('../../shared/db/connection');

const emailTemplateSchema = new Schema({
  app: {
    type: String,
    required: true,
    default: 'ARS'
  },
  process: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  subcode: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  html: {
    type: String,
    required: true
  }
}, {
  collection: 'EMAIL_TEMPLATE_REPOSITORY',
  timestamps: false
});

// Compound unique index for the primary key
emailTemplateSchema.index(
  { app: 1, process: 1, model: 1, code: 1, subcode: 1 },
  { unique: true }
);

module.exports = earsConnection.model('EmailTemplate', emailTemplateSchema);
