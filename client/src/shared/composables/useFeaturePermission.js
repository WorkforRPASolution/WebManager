/**
 * Feature Permission Composable
 * Provides reactive permission checking for features
 */

import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { permissionsApi } from '../api'

// Cache for feature permissions
const permissionsCache = ref({})
const loading = ref(false)
const initialized = ref(false)

/**
 * Fetch all feature permissions for the current user's role
 */
async function fetchPermissions() {
  if (loading.value) return

  loading.value = true
  try {
    const response = await permissionsApi.getAll()
    const permissions = response.data

    // Build cache keyed by feature
    const cache = {}
    for (const perm of permissions) {
      cache[perm.feature] = perm
    }

    permissionsCache.value = cache
    initialized.value = true
  } catch (error) {
    console.error('Failed to fetch feature permissions:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Clear permissions cache (call on logout)
 */
function clearPermissions() {
  permissionsCache.value = {}
  initialized.value = false
}

/**
 * Refresh permissions from server
 */
async function refreshPermissions() {
  initialized.value = false
  await fetchPermissions()
}

/**
 * Hook to use feature permissions
 * @param {string} feature - Feature identifier (equipmentInfo, emailTemplate, users)
 * @returns {Object} - Permission state and helpers
 */
export function useFeaturePermission(feature) {
  const authStore = useAuthStore()

  // Initialize permissions on first use
  onMounted(async () => {
    if (!initialized.value) {
      await fetchPermissions()
    }
  })

  // Get current user's role level
  const roleLevel = computed(() => authStore.authorityManager)

  // Check if user is admin
  const isAdmin = computed(() => roleLevel.value === 1)

  // Get permissions for this feature and role
  const featurePermissions = computed(() => {
    // Admin always has full permissions (regardless of cache state)
    if (isAdmin.value) {
      return { read: true, write: true, delete: true }
    }

    const featurePerm = permissionsCache.value[feature]
    if (!featurePerm) {
      // Default: no permissions
      return { read: false, write: false, delete: false }
    }

    const permissions = featurePerm.permissions
    const userPerms = permissions?.[roleLevel.value]

    return userPerms || { read: false, write: false, delete: false }
  })

  // Individual permission checks
  const canRead = computed(() => featurePermissions.value.read)
  const canWrite = computed(() => featurePermissions.value.write)
  const canDelete = computed(() => featurePermissions.value.delete)

  // Check for any permission
  const hasAnyPermission = computed(() =>
    canRead.value || canWrite.value || canDelete.value
  )

  return {
    // Permissions
    canRead,
    canWrite,
    canDelete,
    hasAnyPermission,

    // State
    isAdmin,
    loading: computed(() => loading.value),
    initialized: computed(() => initialized.value),

    // Actions
    refresh: refreshPermissions
  }
}

/**
 * Hook to manage all feature permissions (for settings dialog)
 * @returns {Object} - All permissions state and helpers
 */
export function useAllFeaturePermissions() {
  const authStore = useAuthStore()
  const allPermissions = ref([])
  const saving = ref(false)
  const fetchLoading = ref(false)

  const isAdmin = computed(() => authStore.authorityManager === 1)

  async function fetchAll() {
    fetchLoading.value = true
    try {
      const response = await permissionsApi.getAll()
      allPermissions.value = response.data
    } catch (error) {
      console.error('Failed to fetch all permissions:', error)
      throw error
    } finally {
      fetchLoading.value = false
    }
  }

  async function updateFeature(feature, permissions) {
    saving.value = true
    try {
      await permissionsApi.update(feature, permissions)
      // Refresh cache
      await fetchPermissions()
    } catch (error) {
      console.error('Failed to update feature permissions:', error)
      throw error
    } finally {
      saving.value = false
    }
  }

  return {
    allPermissions,
    isAdmin,
    loading: fetchLoading,
    saving,
    fetchAll,
    updateFeature,
    refreshCache: refreshPermissions
  }
}

// Export cache management functions
export { fetchPermissions, clearPermissions, refreshPermissions }
