/**
 * Shared color & label constants for System Logs chart components.
 */

/** Log category colors (used by LogCategoryDonut, LogTrendChart) */
export const CATEGORY_COLORS = {
  audit: '#3b82f6',
  error: '#ef4444',
  auth: '#22c55e',
  batch: '#a855f7',
  access: '#f59e0b',
  'eqp-redis': '#f97316'
}

/** Human-readable labels for log categories */
export const CATEGORY_LABELS = {
  audit: 'Audit',
  error: 'Error',
  auth: 'Auth',
  batch: 'Batch',
  access: 'Access',
  'eqp-redis': 'EQP Redis'
}

/** Ordered list of log categories */
export const CATEGORY_KEYS = ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis']

/** Auth-action colors (used by LogAuthBreakdownChart) */
export const AUTH_ACTION_COLORS = {
  login: '#22c55e',
  logout: '#86efac',
  login_failed: '#ef4444',
  signup: '#3b82f6',
  password_change: '#f59e0b',
  password_reset_request: '#f59e0b',
  password_reset_approve: '#f59e0b',
  permission_denied: '#f97316'
}

/** Batch health group colors (used by LogBatchHealthChart) */
export const BATCH_HEALTH_COLORS = {
  success: '#10b981',
  failed: '#ef4444',
  skipped: '#9ca3af',
  other: '#f59e0b'
}
