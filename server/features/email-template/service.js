/**
 * Email Template Service
 * createTemplateService 팩토리 기반 — EMAIL_TEMPLATE_REPOSITORY
 */

const EmailTemplate = require('./model')
const { createTemplateService } = require('../../shared/utils/createTemplateService')

module.exports = createTemplateService(EmailTemplate, 'EMAIL_TEMPLATE_REPOSITORY', {
  requiredFields: ['app', 'process', 'model', 'code', 'subcode', 'title', 'html'],
  extraValidations: (data) => {
    if (data.title && data.title.length > 200) {
      return { title: 'Title must be 200 characters or less' }
    }
    return null
  }
})
