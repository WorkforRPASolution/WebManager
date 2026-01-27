import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { permissionsApi } from '../api'

// Lazy import to avoid circular dependency
let processFilterStore = null
const getProcessFilterStore = () => {
  if (!processFilterStore) {
    const { useProcessFilterStore } = require('./processFilter')
    processFilterStore = useProcessFilterStore()
  }
  return processFilterStore
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)
  const refreshToken = ref(localStorage.getItem('refreshToken') || null)
  const loading = ref(false)
  const initialized = ref(false)

  // Feature permissions cache
  const featurePermissions = ref({})
  const featurePermissionsLoaded = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const permissions = computed(() => user.value?.permissions || {})
  const authorityManager = computed(() => user.value?.authorityManager ?? 3)
  const roleName = computed(() => user.value?.roleName || 'Guest')
  const isAdmin = computed(() => authorityManager.value === 1)

  /**
   * Check if user has permission for a specific feature
   */
  const hasPermission = (feature) => {
    return permissions.value[feature] === true
  }

  /**
   * Check if user has one of the allowed roles
   * @param {number|number[]} allowedRoles - Single role or array of allowed role levels
   */
  const hasRole = (allowedRoles) => {
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(authorityManager.value)
    }
    return authorityManager.value === allowedRoles
  }

  /**
   * Fetch feature permissions for all features
   */
  const fetchFeaturePermissions = async () => {
    if (featurePermissionsLoaded.value) return

    try {
      const response = await permissionsApi.getAll()
      const permissions = response.data

      // Build cache keyed by feature
      const cache = {}
      for (const perm of permissions) {
        cache[perm.feature] = perm
      }

      featurePermissions.value = cache
      featurePermissionsLoaded.value = true
    } catch (error) {
      console.error('Failed to fetch feature permissions:', error)
    }
  }

  /**
   * Get feature permission for a specific action
   * @param {string} feature - Feature identifier (equipmentInfo, emailTemplate, users)
   * @param {string} action - Permission action (read, write, delete)
   * @returns {boolean} - Whether user has the permission
   */
  const hasFeaturePermission = (feature, action) => {
    // Admin always has full permissions
    if (isAdmin.value) return true

    const featurePerm = featurePermissions.value[feature]
    if (!featurePerm) return false

    const rolePerms = featurePerm.permissions?.[authorityManager.value]
    return rolePerms?.[action] === true
  }

  /**
   * Clear feature permissions cache
   */
  const clearFeaturePermissions = () => {
    featurePermissions.value = {}
    featurePermissionsLoaded.value = false
  }

  /**
   * Refresh feature permissions from server
   */
  const refreshFeaturePermissions = async () => {
    featurePermissionsLoaded.value = false
    await fetchFeaturePermissions()
  }

  /**
   * Login with credentials
   */
  const login = async (username, password) => {
    loading.value = true
    try {
      const response = await api.post('/auth/login', { username, password })
      const data = response.data

      token.value = data.token
      refreshToken.value = data.refreshToken
      user.value = data.user

      localStorage.setItem('token', data.token)
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken)
      }

      return {
        success: true,
        mustChangePassword: data.mustChangePassword || false
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed'
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Logout and clear session
   */
  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore logout errors
    }

    token.value = null
    refreshToken.value = null
    user.value = null
    clearFeaturePermissions()

    // Clear process filter cache
    try {
      getProcessFilterStore().clearCache()
    } catch (e) {
      // Ignore if store not initialized
    }

    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  /**
   * Refresh access token
   */
  const refresh = async () => {
    if (!refreshToken.value) return false

    try {
      const response = await api.post('/auth/refresh', {
        refreshToken: refreshToken.value
      })

      token.value = response.data.token
      localStorage.setItem('token', response.data.token)

      return true
    } catch (error) {
      // Refresh failed - logout
      await logout()
      return false
    }
  }

  /**
   * Fetch current user info
   */
  const fetchUser = async () => {
    if (!token.value) {
      initialized.value = true
      return false
    }

    try {
      const response = await api.get('/auth/me')
      user.value = response.data
      initialized.value = true
      return true
    } catch (error) {
      // Token might be invalid - try refresh
      const refreshed = await refresh()
      if (refreshed) {
        try {
          const response = await api.get('/auth/me')
          user.value = response.data
          initialized.value = true
          return true
        } catch (e) {
          // Still failed - logout
        }
      }

      await logout()
      initialized.value = true
      return false
    }
  }

  /**
   * Initialize auth state on app start
   */
  const initialize = async () => {
    if (initialized.value) return

    if (token.value) {
      await fetchUser()
    } else {
      initialized.value = true
    }
  }

  return {
    // State
    user,
    token,
    loading,
    initialized,
    featurePermissions,
    featurePermissionsLoaded,

    // Getters
    isAuthenticated,
    permissions,
    authorityManager,
    roleName,
    isAdmin,

    // Methods
    hasPermission,
    hasRole,
    hasFeaturePermission,
    fetchFeaturePermissions,
    clearFeaturePermissions,
    refreshFeaturePermissions,
    login,
    logout,
    refresh,
    fetchUser,
    initialize
  }
})
