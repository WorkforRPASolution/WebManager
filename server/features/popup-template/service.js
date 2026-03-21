/**
 * Popup Template Service
 * createTemplateService 팩토리 기반 — POPUP_TEMPLATE_REPOSITORY
 */

const PopupTemplate = require('./model')
const { createTemplateService } = require('../../shared/utils/createTemplateService')

module.exports = createTemplateService(PopupTemplate, 'POPUP_TEMPLATE_REPOSITORY', {
  requiredFields: ['app', 'process', 'model', 'code', 'subcode', 'html']
})
