<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Update Settings
          </h3>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex-1 flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        </div>

        <!-- Content -->
        <div v-else class="flex-1 overflow-auto p-4 space-y-6">
          <!-- Packages Section -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Packages</h4>
              <button
                @click="addPackage"
                class="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
            <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-50 dark:bg-dark-bg">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-1/5">Name</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Target Path</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-24">Type</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-1/5">Description</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-16">Del</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-dark-border">
                  <tr v-for="(pkg, index) in packages" :key="pkg._key">
                    <td class="px-3 py-1.5">
                      <input v-model="pkg.name" @input="changed = true"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                        :class="{ 'border-red-500': pkg._nameError }"
                        placeholder="Agent Binary" />
                      <p v-if="pkg._nameError" class="mt-0.5 text-xs text-red-500">{{ pkg._nameError }}</p>
                    </td>
                    <td class="px-3 py-1.5">
                      <input v-model="pkg.targetPath" @input="changed = true"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                        :class="{ 'border-red-500': pkg._pathError }"
                        placeholder="bin/agent.jar" />
                      <p v-if="pkg._pathError" class="mt-0.5 text-xs text-red-500">{{ pkg._pathError }}</p>
                    </td>
                    <td class="px-3 py-1.5">
                      <select v-model="pkg.targetType" @change="changed = true"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                        <option value="file">file</option>
                        <option value="directory">directory</option>
                      </select>
                    </td>
                    <td class="px-3 py-1.5">
                      <input v-model="pkg.description" @input="changed = true"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                        placeholder="Optional" />
                    </td>
                    <td class="px-3 py-1.5 text-center">
                      <button @click="removePackage(index)"
                        class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr v-if="packages.length === 0">
                    <td colspan="5" class="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No packages. Click "Add" to create one.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Source Section -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Update Source</h4>
            <div class="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 space-y-4">
              <div class="flex items-center gap-4">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Type</label>
                <select v-model="source.type" @change="changed = true"
                  class="px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                  <option value="local">Local Path</option>
                  <option value="ftp">External FTP</option>
                  <option value="minio">MinIO (S3)</option>
                </select>
              </div>

              <!-- Local Source -->
              <div v-if="source.type === 'local'" class="flex items-center gap-4">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Path</label>
                <input v-model="source.localPath" @input="changed = true"
                  class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                  placeholder="/opt/releases/ars-agent/latest" />
              </div>

              <!-- FTP Source -->
              <template v-if="source.type === 'ftp'">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Host</label>
                    <input v-model="source.ftpHost" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                      placeholder="ftp.example.com" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                    <input v-model.number="source.ftpPort" @input="changed = true" type="number"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="21" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">User</label>
                    <input v-model="source.ftpUser" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="ftpuser" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Password</label>
                    <input v-model="source.ftpPass" @input="changed = true" type="password"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="********" />
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                  <input v-model="source.ftpBasePath" @input="changed = true"
                    class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                    placeholder="/releases" />
                </div>
              </template>

              <!-- MinIO Source -->
              <template v-if="source.type === 'minio'">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Endpoint</label>
                    <input v-model="source.minioEndpoint" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                      placeholder="localhost" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                    <input v-model.number="source.minioPort" @input="changed = true" type="number"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="9000" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Bucket</label>
                    <input v-model="source.minioBucket" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                      placeholder="update-source" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex items-center gap-1">
                      <input type="checkbox" v-model="source.minioUseSSL" @change="changed = true"
                        class="rounded border-gray-300 dark:border-dark-border text-green-500 focus:ring-green-500" />
                      SSL
                    </label>
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Access Key</label>
                    <input v-model="source.minioAccessKey" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="minioadmin" />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Secret Key</label>
                    <input v-model="source.minioSecretKey" @input="changed = true" type="password"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                      placeholder="********" />
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                  <input v-model="source.minioBasePath" @input="changed = true"
                    class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                    placeholder="(optional prefix)" />
                </div>
              </template>
            </div>
          </div>

          <!-- Error message -->
          <p v-if="saveError" class="text-sm text-red-500">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="changed" class="text-amber-500">Unsaved changes</span>
          </div>
          <div class="flex gap-3">
            <button @click="handleClose"
              class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
              Cancel
            </button>
            <button @click="handleSave" :disabled="!changed || saving"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { updateSettingsApi } from '../api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentGroup: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'saved'])

const loading = ref(false)
const saving = ref(false)
const changed = ref(false)
const saveError = ref(null)
const packages = ref([])
const source = reactive({
  type: 'local',
  localPath: '',
  ftpHost: '',
  ftpPort: 21,
  ftpUser: '',
  ftpPass: '',
  ftpBasePath: '',
  minioEndpoint: '',
  minioPort: 9000,
  minioBucket: '',
  minioAccessKey: '',
  minioSecretKey: '',
  minioUseSSL: false,
  minioBasePath: ''
})
let keyCounter = 0

watch(() => props.modelValue, async (v) => {
  if (v && props.agentGroup) await loadData()
})

async function loadData() {
  loading.value = true
  changed.value = false
  saveError.value = null
  try {
    const response = await updateSettingsApi.getSettings(props.agentGroup)
    const doc = response.data
    packages.value = (doc.packages || []).map(p => ({
      _key: `k_${keyCounter++}`,
      packageId: p.packageId,
      name: p.name,
      targetPath: p.targetPath,
      targetType: p.targetType || 'file',
      description: p.description || '',
      _nameError: null,
      _pathError: null
    }))
    const s = doc.source || {}
    source.type = s.type || 'local'
    source.localPath = s.localPath || ''
    source.ftpHost = s.ftpHost || ''
    source.ftpPort = s.ftpPort || 21
    source.ftpUser = s.ftpUser || ''
    source.ftpPass = s.ftpPass || ''
    source.ftpBasePath = s.ftpBasePath || ''
    source.minioEndpoint = s.minioEndpoint || ''
    source.minioPort = s.minioPort || 9000
    source.minioBucket = s.minioBucket || ''
    source.minioAccessKey = s.minioAccessKey || ''
    source.minioSecretKey = s.minioSecretKey || ''
    source.minioUseSSL = s.minioUseSSL || false
    source.minioBasePath = s.minioBasePath || ''
  } catch (error) {
    console.error('Failed to load update settings:', error)
    packages.value = []
  } finally {
    loading.value = false
  }
}

function addPackage() {
  packages.value.push({
    _key: `k_${keyCounter++}`,
    packageId: null,
    name: '',
    targetPath: '',
    targetType: 'file',
    description: '',
    _nameError: null,
    _pathError: null
  })
  changed.value = true
}

function removePackage(index) {
  packages.value.splice(index, 1)
  changed.value = true
}

function validate() {
  let valid = true
  for (const pkg of packages.value) {
    pkg._nameError = null
    pkg._pathError = null
    if (!pkg.name || !pkg.name.trim()) {
      pkg._nameError = 'Required'
      valid = false
    }
    if (!pkg.targetPath || !pkg.targetPath.trim()) {
      pkg._pathError = 'Required'
      valid = false
    }
  }
  return valid
}

async function handleSave() {
  if (!validate()) return
  saving.value = true
  saveError.value = null
  try {
    const pkgs = packages.value.map(p => ({
      packageId: p.packageId,
      name: p.name.trim(),
      targetPath: p.targetPath.trim(),
      targetType: p.targetType,
      description: (p.description || '').trim()
    }))
    await updateSettingsApi.saveSettings(props.agentGroup, pkgs, { ...source })
    changed.value = false
    emit('saved')
    emit('update:modelValue', false)
  } catch (error) {
    saveError.value = error.response?.data?.message || error.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>
