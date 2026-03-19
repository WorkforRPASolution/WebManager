<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Permissions</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage role-based menu access and feature permissions</p>
      </div>
      <button
        @click="fetchAll"
        :disabled="loading"
        class="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors disabled:opacity-50"
        title="Reload permissions"
      >
        <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Tab Bar -->
    <div class="flex border-b border-gray-200 dark:border-dark-border">
      <button
        @click="activeTab = 'menu'"
        :class="[
          'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
          activeTab === 'menu'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        Menu Permissions
      </button>
      <button
        @click="activeTab = 'feature'"
        :class="[
          'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
          activeTab === 'feature'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        Feature Permissions
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading permissions...</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-red-500 dark:text-red-400 mb-2">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
        <button
          @click="fetchAll"
          class="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Tab 1: Menu Permissions -->
      <div
        v-show="activeTab === 'menu'"
        class="flex-1 min-h-0 flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border"
      >
        <div class="flex-1 min-h-0 overflow-auto">
          <table>
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-dark-border">
                <th class="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width:240px">
                  Permission
                </th>
                <th
                  v-for="role in roleDefinitions"
                  :key="role.level"
                  class="text-center py-3 px-3 text-xs font-semibold uppercase tracking-wider"
                  :class="role.level === 1 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'"
                  style="width:100px"
                >
                  {{ role.name }}
                  <span class="block text-[10px] font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                    Level {{ role.level }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(group, gIdx) in menuPermissionGroups" :key="group.label">
                <!-- Group spacer -->
                <tr v-if="gIdx > 0" class="h-3"></tr>
                <!-- Group header row -->
                <tr
                  class="border-b border-gray-100 dark:border-dark-border/50 cursor-pointer select-none hover:bg-primary-50/50 dark:hover:bg-primary-900/10"
                  @click="toggleCollapse('menu', group.label)"
                >
                  <td class="py-2.5 px-4">
                    <div class="flex items-center gap-2">
                      <svg
                        class="w-4 h-4 text-gray-400 transition-transform"
                        :class="{ '-rotate-90': isCollapsed('menu', group.label) }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ group.label }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-border text-gray-400 dark:text-gray-500">
                        {{ group.keys.length }}
                      </span>
                    </div>
                  </td>
                  <td
                    v-for="role in roleDefinitions"
                    :key="role.level"
                    class="py-2.5 px-3 text-center"
                    @click.stop
                  >
                    <ToggleSwitch
                      :model-value="isMenuGroupAllChecked(group, role.level)"
                      @update:model-value="handleMenuGroupToggle(group, role.level, $event)"
                      :disabled="role.level === 1"
                    />
                  </td>
                </tr>

                <!-- Permission rows -->
                <template v-if="!isCollapsed('menu', group.label)">
                  <tr
                    v-for="perm in group.keys"
                    :key="perm.key"
                    class="border-b border-gray-50 dark:border-dark-border/30"
                  >
                    <td class="py-2 px-4 pl-11">
                      <span class="text-sm text-gray-600 dark:text-gray-300">{{ perm.name }}</span>
                    </td>
                    <td
                      v-for="role in roleDefinitions"
                      :key="role.level"
                      class="py-2 px-3 text-center"
                      :class="{ 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12]': isMenuCellChanged(perm.key, role.level) }"
                    >
                      <ToggleSwitch
                        :model-value="getMenuPermission(perm.key, role.level)"
                        @update:model-value="setMenuPermission(perm.key, role.level, $event)"
                        :disabled="role.level === 1"
                      />
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-border">
          <div class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Admin permissions are always full access and cannot be modified.
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="handleMenuDiscard"
              :disabled="!menuHasChanges"
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              @click="handleMenuSave"
              :disabled="!menuHasChanges || saving"
              class="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 2: Feature Permissions -->
      <div
        v-show="activeTab === 'feature'"
        class="flex-1 min-h-0 flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border"
      >
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="table-fixed">
            <colgroup>
              <col style="width:220px" />
              <template v-for="(role, rIdx) in roleDefinitions" :key="'col-' + role.level">
                <col v-if="rIdx > 0" style="width:16px" />
                <col v-for="action in ['read', 'write', 'delete']" :key="action" style="width:76px" />
              </template>
            </colgroup>
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-dark-border">
                <th class="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider" rowspan="2">
                  Feature
                </th>
                <template v-for="(role, rIdx) in roleDefinitions" :key="role.level">
                  <th v-if="rIdx > 0" rowspan="2" class="bg-gray-50 dark:bg-slate-800"></th>
                  <th
                    class="text-center py-2 px-0 text-xs font-semibold uppercase tracking-wider"
                    :class="role.level === 1 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'"
                    colspan="3"
                  >
                    {{ role.name }}
                    <span class="block text-[10px] font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                      Level {{ role.level }}
                    </span>
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in featurePermissionGroups" :key="group.label">
                <!-- Group header row -->
                <tr
                  class="border-b border-gray-100 dark:border-dark-border/50 bg-gray-50/50 dark:bg-slate-800/30 cursor-pointer select-none hover:bg-primary-50/50 dark:hover:bg-primary-900/10"
                  @click="toggleCollapse('feature', group.label)"
                >
                  <td class="py-2.5 px-4">
                    <div class="flex items-center gap-2">
                      <svg
                        class="w-4 h-4 text-gray-400 transition-transform"
                        :class="{ '-rotate-90': isCollapsed('feature', group.label) }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ group.label }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-border text-gray-400 dark:text-gray-500">
                        {{ group.keys.length }}
                      </span>
                    </div>
                  </td>
                  <template v-for="(role, rIdx) in roleDefinitions" :key="role.level">
                    <td v-if="rIdx > 0" class="bg-gray-50/50 dark:bg-slate-800/30" @click.stop></td>
                    <td
                      v-for="action in ['read', 'write', 'delete']"
                      :key="action"
                      class="py-2.5 px-0 text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                      @click.stop
                    >
                      {{ group.columnLabels[action] }}
                    </td>
                  </template>
                </tr>

                <!-- Feature rows -->
                <template v-if="!isCollapsed('feature', group.label)">
                  <tr
                    v-for="feat in group.keys"
                    :key="feat.key"
                    class="border-b border-gray-50 dark:border-dark-border/30"
                  >
                    <td class="py-2 px-4 pl-11">
                      <span class="text-sm text-gray-600 dark:text-gray-300">{{ feat.name }}</span>
                    </td>
                    <template v-for="(role, rIdx) in roleDefinitions" :key="role.level">
                      <td v-if="rIdx > 0"></td>
                      <td
                        v-for="action in ['read', 'write', 'delete']"
                        :key="action"
                        class="py-2 px-0 text-center"
                        :class="isFeatureCellChanged(feat.key, role.level, action) ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12]' : ''"
                      >
                        <ToggleSwitch
                          :model-value="getFeaturePermission(feat.key, role.level, action)"
                          @update:model-value="setFeaturePermission(feat.key, role.level, action, $event)"
                          :disabled="role.level === 1"
                        />
                      </td>
                    </template>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-border">
          <div class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Admin permissions are always full access and cannot be modified.
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="handleFeatureDiscard"
              :disabled="!featureHasChanges"
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              @click="handleFeatureSave"
              :disabled="!featureHasChanges || saving"
              class="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Toast Notification -->
    <Teleport to="body">
      <div
        v-if="toast.show"
        class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg"
        :class="{
          'bg-green-500 text-white': toast.type === 'success',
          'bg-red-500 text-white': toast.type === 'error',
          'bg-amber-500 text-white': toast.type === 'warning',
        }"
      >
        <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ toast.message }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ToggleSwitch from '@/shared/components/ToggleSwitch.vue'
import { usersApi } from '../users/api'
import { permissionsApi } from '@/shared/api'
import { useToast } from '@/shared/composables/useToast'
import {
  menuPermissionGroups,
  featurePermissionGroups,
  roleDefinitions,
  toggleGroupAll,
  hasMenuChanges,
  discardMenuChanges,
  getFilteredFeaturePermissions,
  hasFeatureChanges,
  discardFeatureChanges,
  toggleFeatureGroupAll,
} from './permissionUtils'

const { toast, showToast } = useToast()

// ──────────────────────────────────────
// State
// ──────────────────────────────────────
const activeTab = ref('menu')
const loading = ref(false)
const saving = ref(false)
const error = ref(null)

// Menu permissions state
const menuRoles = ref([])
const originalMenuRoles = ref([])

// Feature permissions state
const featurePerms = ref({})
const originalFeaturePerms = ref({})

// Collapse state
const collapsedGroups = ref({})

// ──────────────────────────────────────
// Collapse handling
// ──────────────────────────────────────
function toggleCollapse(tab, groupLabel) {
  const key = `${tab}_${groupLabel}`
  collapsedGroups.value[key] = !collapsedGroups.value[key]
}

function isCollapsed(tab, groupLabel) {
  const key = `${tab}_${groupLabel}`
  return !!collapsedGroups.value[key]
}

// ──────────────────────────────────────
// Menu Permission accessors
// ──────────────────────────────────────
function getMenuPermission(permKey, roleLevel) {
  const role = menuRoles.value.find(r => r.roleLevel === roleLevel)
  return role?.permissions?.[permKey] ?? false
}

function setMenuPermission(permKey, roleLevel, value) {
  if (roleLevel === 1) return
  const role = menuRoles.value.find(r => r.roleLevel === roleLevel)
  if (role?.permissions) {
    role.permissions[permKey] = value
  }
}

function isMenuGroupAllChecked(group, roleLevel) {
  const role = menuRoles.value.find(r => r.roleLevel === roleLevel)
  if (!role?.permissions) return false
  return group.keys.every(p => role.permissions[p.key])
}

function handleMenuGroupToggle(group, roleLevel, value) {
  const groupKeys = group.keys.map(p => p.key)
  toggleGroupAll(menuRoles.value, groupKeys, roleLevel, value)
}

function isMenuCellChanged(permKey, roleLevel) {
  const orig = originalMenuRoles.value.find(r => r.roleLevel === roleLevel)
  const curr = menuRoles.value.find(r => r.roleLevel === roleLevel)
  if (!orig?.permissions || !curr?.permissions) return false
  return orig.permissions[permKey] !== curr.permissions[permKey]
}

const menuHasChanges = computed(() => {
  return hasMenuChanges(originalMenuRoles.value, menuRoles.value)
})

// ──────────────────────────────────────
// Feature Permission accessors
// ──────────────────────────────────────
function getFeaturePermission(featureKey, roleLevel, action) {
  return featurePerms.value[featureKey]?.permissions?.[roleLevel]?.[action] ?? false
}

function setFeaturePermission(featureKey, roleLevel, action, value) {
  if (roleLevel === 1) return
  const feat = featurePerms.value[featureKey]
  if (feat?.permissions?.[roleLevel]) {
    feat.permissions[roleLevel][action] = value
  }
}

function isFeatureCellChanged(featureKey, roleLevel, action) {
  const origVal = originalFeaturePerms.value[featureKey]?.permissions?.[roleLevel]?.[action]
  const currVal = featurePerms.value[featureKey]?.permissions?.[roleLevel]?.[action]
  if (origVal === undefined || currVal === undefined) return false
  return origVal !== currVal
}

const featureHasChanges = computed(() => {
  return hasFeatureChanges(originalFeaturePerms.value, featurePerms.value)
})

// ──────────────────────────────────────
// Data fetching
// ──────────────────────────────────────
async function fetchMenuRoles() {
  const response = await usersApi.getRoles()
  menuRoles.value = JSON.parse(JSON.stringify(response.data))
  originalMenuRoles.value = JSON.parse(JSON.stringify(response.data))
}

async function fetchFeaturePerms() {
  const response = await permissionsApi.getAll()
  const filtered = getFilteredFeaturePermissions(response.data)

  // Convert array to object keyed by feature name
  const permsObj = {}
  for (const item of filtered) {
    permsObj[item.feature] = JSON.parse(JSON.stringify(item))
  }
  featurePerms.value = permsObj
  originalFeaturePerms.value = JSON.parse(JSON.stringify(permsObj))
}

async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    await Promise.all([fetchMenuRoles(), fetchFeaturePerms()])
  } catch (err) {
    console.error('Failed to fetch permissions:', err)
    error.value = err.response?.data?.message || 'Failed to load permissions'
  } finally {
    loading.value = false
  }
}

// ──────────────────────────────────────
// Save / Discard - Menu
// ──────────────────────────────────────
async function handleMenuSave() {
  if (!menuHasChanges.value) return
  saving.value = true
  try {
    for (const role of menuRoles.value) {
      if (role.roleLevel === 1) continue // Skip Admin

      const original = originalMenuRoles.value.find(r => r.roleLevel === role.roleLevel)
      if (JSON.stringify(role.permissions) !== JSON.stringify(original?.permissions)) {
        await usersApi.updateRole(role.roleLevel, role.permissions)
      }
    }
    originalMenuRoles.value = JSON.parse(JSON.stringify(menuRoles.value))
    showToast('success', 'Menu permissions saved')
  } catch (err) {
    console.error('Failed to save menu permissions:', err)
    showToast('error', err.response?.data?.message || 'Failed to save menu permissions')
  } finally {
    saving.value = false
  }
}

function handleMenuDiscard() {
  menuRoles.value = discardMenuChanges(originalMenuRoles.value)
  showToast('warning', 'Menu changes discarded')
}

// ──────────────────────────────────────
// Save / Discard - Feature
// ──────────────────────────────────────
async function handleFeatureSave() {
  if (!featureHasChanges.value) return
  saving.value = true
  try {
    for (const [featureKey, feat] of Object.entries(featurePerms.value)) {
      const origFeat = originalFeaturePerms.value[featureKey]
      if (JSON.stringify(feat.permissions) !== JSON.stringify(origFeat?.permissions)) {
        await permissionsApi.update(featureKey, feat.permissions)
      }
    }
    originalFeaturePerms.value = JSON.parse(JSON.stringify(featurePerms.value))
    showToast('success', 'Feature permissions saved')
  } catch (err) {
    console.error('Failed to save feature permissions:', err)
    showToast('error', err.response?.data?.message || 'Failed to save feature permissions')
  } finally {
    saving.value = false
  }
}

function handleFeatureDiscard() {
  featurePerms.value = discardFeatureChanges(originalFeaturePerms.value)
  showToast('warning', 'Feature changes discarded')
}

// ──────────────────────────────────────
// Init
// ──────────────────────────────────────
onMounted(() => {
  fetchAll()
})
</script>
