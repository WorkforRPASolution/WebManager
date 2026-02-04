/**
 * Popup Template Model
 * POPUP_TEMPLATE_REPOSITORY - Popup templates
 *
 * Database: EARS (shared with Akka server)
 */

const { Schema } = require('mongoose');
const { earsConnection } = require('../../shared/db/connection');

const popupTemplateSchema = new Schema({
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
    required: true,
    default: '_'
  },
  html: {
    type: String,
    required: true
  }
}, {
  collection: 'POPUP_TEMPLATE_REPOSITORY',
  timestamps: false
});

// Compound unique index for the primary key
popupTemplateSchema.index(
  { app: 1, process: 1, model: 1, code: 1, subcode: 1 },
  { unique: true }
);

module.exports = earsConnection.model('PopupTemplate', popupTemplateSchema);
