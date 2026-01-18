const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
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
  htmp: {
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

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
