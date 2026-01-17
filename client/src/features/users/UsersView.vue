<script setup>
import { ref, onMounted, computed } from 'vue'
import { usersApi } from './api'
import UserList from './components/UserList.vue'
import UserFormModal from './components/UserFormModal.vue'
import DeleteConfirmModal from './components/DeleteConfirmModal.vue'
import AppIcon from '../../shared/components/AppIcon.vue'

// 상태
const users = ref([])
const roles = ref([])
const loading = ref(false)
const error = ref(null)

// 필터
const searchQuery = ref('')
const selectedRole = ref('')
const showActiveOnly = ref(false)

// 모달 상태
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const editingUser = ref(null)
const selectedUsers = ref([])

// 필터링된 유저 목록
const filteredUsers = computed(() => {
  return users.value
})

// 데이터 로드
async function loadUsers() {
  loading.value = true
  error.value = null

  try {
    const params = {}
    if (searchQuery.value) params.search = searchQuery.value
    if (selectedRole.value) params.role = selectedRole.value
    if (showActiveOnly.value) params.isActive = 'true'

    const response = await usersApi.getUsers(params)
    users.value = response.data
  } catch (err) {
    error.value = 'Failed to load users'
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const response = await usersApi.getRoles()
    roles.value = response.data
  } catch (err) {
    console.error('Failed to load roles:', err)
  }
}

// 유저 추가
function handleAdd() {
  editingUser.value = null
  showFormModal.value = true
}

// 유저 수정
function handleEdit(user) {
  editingUser.value = { ...user }
  showFormModal.value = true
}

// 유저 삭제 확인
function handleDelete(user) {
  selectedUsers.value = [user]
  showDeleteModal.value = true
}

// 다중 삭제 확인
function handleBulkDelete() {
  if (selectedUsers.value.length === 0) return
  showDeleteModal.value = true
}

// 폼 저장
async function handleSave(userData) {
  try {
    if (editingUser.value) {
      await usersApi.updateUser(editingUser.value._id, userData)
    } else {
      await usersApi.createUser(userData)
    }
    showFormModal.value = false
    await loadUsers()
  } catch (err) {
    throw err
  }
}

// 삭제 확인
async function handleConfirmDelete() {
  try {
    if (selectedUsers.value.length === 1) {
      await usersApi.deleteUser(selectedUsers.value[0]._id)
    } else {
      await usersApi.deleteUsers(selectedUsers.value.map(u => u._id))
    }
    showDeleteModal.value = false
    selectedUsers.value = []
    await loadUsers()
  } catch (err) {
    console.error('Failed to delete:', err)
  }
}

// 선택 변경
function handleSelectionChange(selected) {
  selectedUsers.value = selected
}

// 검색
function handleSearch() {
  loadUsers()
}

// 초기화
function handleClear() {
  searchQuery.value = ''
  selectedRole.value = ''
  showActiveOnly.value = false
  loadUsers()
}

onMounted(() => {
  loadUsers()
  loadRoles()
})
</script>

<template>
  <div class="p-6">
    <!-- 헤더 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage system users and permissions</p>
    </div>

    <!-- 필터 바 -->
    <div class="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border p-4 mb-4">
      <div class="flex flex-wrap items-center gap-4">
        <!-- 검색 -->
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, username, or email..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- 역할 필터 -->
        <select
          v-model="selectedRole"
          class="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          @change="handleSearch"
        >
          <option value="">All Roles</option>
          <option v-for="role in roles" :key="role.id" :value="role.id">
            {{ role.label }}
          </option>
        </select>

        <!-- 활성 유저만 -->
        <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <input
            v-model="showActiveOnly"
            type="checkbox"
            class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            @change="handleSearch"
          />
          <span>Active only</span>
        </label>

        <!-- 버튼 -->
        <button
          @click="handleSearch"
          class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Search
        </button>
        <button
          @click="handleClear"
          class="px-4 py-2 bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- 툴바 -->
    <div class="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border p-4 mb-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            @click="handleAdd"
            class="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <AppIcon name="plus" size="4" />
            Add User
          </button>
          <button
            v-if="selectedUsers.length > 0"
            @click="handleBulkDelete"
            class="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <AppIcon name="trash" size="4" />
            Delete ({{ selectedUsers.length }})
          </button>
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Total: {{ users.length }} users
        </div>
      </div>
    </div>

    <!-- 로딩/에러 상태 -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="loadUsers" class="mt-2 text-primary-500 hover:underline">Retry</button>
    </div>

    <!-- 유저 목록 -->
    <UserList
      v-else
      :users="users"
      :roles="roles"
      @edit="handleEdit"
      @delete="handleDelete"
      @selection-change="handleSelectionChange"
    />

    <!-- 유저 폼 모달 -->
    <UserFormModal
      v-if="showFormModal"
      :user="editingUser"
      :roles="roles"
      @save="handleSave"
      @close="showFormModal = false"
    />

    <!-- 삭제 확인 모달 -->
    <DeleteConfirmModal
      v-if="showDeleteModal"
      :count="selectedUsers.length"
      :names="selectedUsers.map(u => u.name)"
      @confirm="handleConfirmDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>
