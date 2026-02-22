/**
 * config-form/index.js
 *
 * Barrel file for external consumers.
 * Internal imports should use direct paths to domain modules.
 */

// Detection utility
export { detectConfigFileType } from './shared/configDetection'

// Main form view
export { default as ConfigFormView } from './ConfigFormView.vue'
