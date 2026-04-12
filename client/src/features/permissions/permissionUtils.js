/**
 * Permission utility functions for Menu Permissions and Feature Permissions
 *
 * Extracted from RolePermissionDialog.vue and PermissionSettingsDialog.vue
 */

// ──────────────────────────────────────
// Permission name mapping
// ──────────────────────────────────────
const permissionNames = {
  dashboardOverview: 'Overview',
  dashboardArsMonitor: 'ARSAgent Status',
  dashboardArsVersion: 'ARSAgent Version',
  dashboardResStatus: 'ResourceAgent Status',
  dashboardResVersion: 'ResourceAgent Version',
  dashboardRecoveryOverview: 'Recovery Overview',
  dashboardRecoveryByProcess: 'Recovery by Process',
  dashboardRecoveryByModel: 'Recovery by Model',
  dashboardRecoveryAnalysis: 'Recovery Analysis',
  dashboardRecoveryByCategory: 'Recovery by Category',
  dashboardUserActivity: 'User Activity',
  arsAgent: 'ARS Agent',
  resourceAgent: 'Resource Agent',
  equipmentInfo: 'Equipment Info',
  emailTemplate: 'Email Template',
  popupTemplate: 'Popup Template',
  emailRecipients: 'Email Recipients',
  emailInfo: 'Email Info',
  emailImage: 'Email Image',
  users: 'User Management',
  alerts: 'Alerts',
  settings: 'Settings',
  clientControl: 'Client Control',
}

/**
 * Convert permission key to human-readable name
 */
export function formatPermissionName(key) {
  return permissionNames[key] || key
}

// ──────────────────────────────────────
// Menu Permission Groups (5 groups, 19 items)
// ──────────────────────────────────────
export const menuPermissionGroups = [
  {
    label: 'Dashboard',
    keys: [
      { key: 'dashboardOverview', name: 'Overview' },
      { key: 'dashboardArsMonitor', name: 'ARSAgent Status' },
      { key: 'dashboardArsVersion', name: 'ARSAgent Version' },
      { key: 'dashboardResStatus', name: 'ResourceAgent Status' },
      { key: 'dashboardResVersion', name: 'ResourceAgent Version' },
    ]
  },
  {
    label: 'Dashboard - Recovery',
    keys: [
      { key: 'dashboardRecoveryOverview', name: 'Recovery Overview' },
      { key: 'dashboardRecoveryByProcess', name: 'Recovery by Process' },
      { key: 'dashboardRecoveryByModel', name: 'Recovery by Model' },
      { key: 'dashboardRecoveryAnalysis', name: 'Recovery Analysis' },
      { key: 'dashboardRecoveryByCategory', name: 'Recovery by Category' },
    ]
  },
  {
    label: 'Dashboard - User Activity',
    keys: [
      { key: 'dashboardUserActivity', name: 'User Activity' },
    ]
  },
  {
    label: 'Clients',
    keys: [
      { key: 'arsAgent', name: 'ARS Agent' },
      { key: 'resourceAgent', name: 'Resource Agent' },
    ]
  },
  {
    label: '기준정보 관리',
    keys: [
      { key: 'equipmentInfo', name: 'Equipment Info' },
      { key: 'emailTemplate', name: 'Email Template' },
      { key: 'popupTemplate', name: 'Popup Template' },
      { key: 'emailRecipients', name: 'Email Recipients' },
      { key: 'emailInfo', name: 'Email Info' },
      { key: 'emailImage', name: 'Email Image' },
      { key: 'users', name: 'User Management' },
    ]
  },
  {
    label: 'System',
    keys: [
      { key: 'alerts', name: 'Alerts' },
      { key: 'settings', name: 'Settings' },
    ]
  }
]

// ──────────────────────────────────────
// Feature Permission Groups (2 groups)
// ──────────────────────────────────────
export const featurePermissionGroups = [
  {
    label: 'Clients',
    columnLabels: { read: 'Monitoring', write: 'Operations', delete: 'Deploy' },
    keys: [
      { key: 'clientControl', name: 'Client Control' },
    ]
  },
  {
    label: '기준정보 관리',
    columnLabels: { read: 'Read', write: 'Write', delete: 'Delete' },
    keys: [
      { key: 'equipmentInfo', name: 'Equipment Info' },
      { key: 'emailTemplate', name: 'Email Template' },
      { key: 'popupTemplate', name: 'Popup Template' },
      { key: 'emailRecipients', name: 'Email Recipients' },
      { key: 'emailInfo', name: 'Email Info' },
      { key: 'emailImage', name: 'Email Image' },
      { key: 'users', name: 'User Management' },
    ]
  }
]

// ──────────────────────────────────────
// Role definitions
// ──────────────────────────────────────
export const roleDefinitions = [
  { level: 1, name: 'Admin', description: 'Full system access' },
  { level: 2, name: 'Conductor', description: 'Senior user with elevated privileges' },
  { level: 3, name: 'Manager', description: 'Team manager' },
  { level: 0, name: 'User', description: 'Standard user' },
]

// ──────────────────────────────────────
// Menu Permission utilities
// ──────────────────────────────────────

/**
 * Toggle all permissions in a group for a specific role level.
 * Admin (level 1) is protected and cannot be modified.
 *
 * @param {Array} roles - Array of role objects with { roleLevel, permissions }
 * @param {string[]} groupKeys - Permission keys in the group
 * @param {number} roleLevel - The role level to modify
 * @param {boolean} value - The value to set
 */
export function toggleGroupAll(roles, groupKeys, roleLevel, value) {
  if (roleLevel === 1) return // Admin is protected

  const role = roles.find(r => r.roleLevel === roleLevel)
  if (!role) return

  for (const key of groupKeys) {
    if (role.permissions[key] !== undefined) {
      role.permissions[key] = value
    }
  }
}

/**
 * Detect changes between original and current menu permission states.
 *
 * @param {Array} original - Original roles array
 * @param {Array} current - Current roles array
 * @returns {boolean}
 */
export function hasMenuChanges(original, current) {
  return JSON.stringify(original) !== JSON.stringify(current)
}

/**
 * Deep clone original menu permissions for discard.
 *
 * @param {Array} original - Original roles array
 * @returns {Array} Deep-cloned copy
 */
export function discardMenuChanges(original) {
  return JSON.parse(JSON.stringify(original))
}

// ──────────────────────────────────────
// Feature Permission utilities
// ──────────────────────────────────────

/**
 * Filter out osVersion from feature permissions (should not appear in UI).
 *
 * @param {Array} permissions - Array of { feature, permissions } objects
 * @returns {Array} Filtered array without osVersion
 */
export function getFilteredFeaturePermissions(permissions) {
  return permissions.filter(p => p.feature !== 'osVersion')
}

/**
 * Toggle all feature permissions in a group for a specific role level.
 * Admin (level 1) is protected and cannot be modified.
 *
 * @param {Object} featurePerms - Object keyed by feature name, each with { permissions: { [level]: { read, write, delete } } }
 * @param {string[]} groupKeys - Feature keys in the group
 * @param {number} roleLevel - The role level to modify
 * @param {boolean} value - The value to set
 */
export function toggleFeatureGroupAll(featurePerms, groupKeys, roleLevel, value) {
  if (roleLevel === 1) return // Admin is protected

  for (const key of groupKeys) {
    const feat = featurePerms[key]
    if (!feat || !feat.permissions || !feat.permissions[roleLevel]) continue
    feat.permissions[roleLevel].read = value
    feat.permissions[roleLevel].write = value
    feat.permissions[roleLevel].delete = value
  }
}

/**
 * Detect changes between original and current feature permission states.
 *
 * @param {Object} original
 * @param {Object} current
 * @returns {boolean}
 */
export function hasFeatureChanges(original, current) {
  return JSON.stringify(original) !== JSON.stringify(current)
}

/**
 * Deep clone original feature permissions for discard.
 *
 * @param {Object} original
 * @returns {Object} Deep-cloned copy
 */
export function discardFeatureChanges(original) {
  return JSON.parse(JSON.stringify(original))
}
