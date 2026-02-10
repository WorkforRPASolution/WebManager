import api from '../../shared/api'

export const clientListApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getClients: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.processes?.length) params.process = filters.processes.join(',')
    if (filters.models?.length) params.model = filters.models.join(',')
    if (filters.ipSearch) params.ipSearch = filters.ipSearch
    if (filters.status?.length) params.status = filters.status.join(',')
    // 키워드 검색 시 process 권한 필터링
    if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0) {
      params.userProcesses = filters.userProcesses.join(',')
    }
    return api.get('/clients/list', { params })
  },

  getProcesses: () => api.get('/clients/processes'),

  getModels: (process) => {
    const params = process ? { process } : {}
    return api.get('/clients/models', { params })
  },

  // Batch Control APIs (Mock)
  controlClients: (ids, action) =>
    api.post('/clients/control', { ids, action }),

  updateClients: (ids, version) =>
    api.post('/clients/update', { ids, version }),

  configClients: (ids, settings) =>
    api.post('/clients/config', { ids, settings }),
}

// Config Management API (FTP via ManagerAgent)
export const clientConfigApi = {
  // Config 파일 설정 조회 (이름, 경로)
  getSettings: (agentGroup) => api.get('/clients/config/settings', { params: { agentGroup } }),

  // Config 파일 일괄 읽기
  getConfigs: (eqpId, agentGroup) => api.get(`/clients/${eqpId}/config`, { params: { agentGroup }, timeout: 60000 }),

  // 단일 Config 파일 저장
  updateConfig: (eqpId, fileId, content, agentGroup) =>
    api.put(`/clients/${eqpId}/config/${fileId}`, { content, agentGroup }, { timeout: 60000 }),

  // 횡전개 대상 Client 목록 (같은 eqpModel)
  getClientsByModel: (eqpModel, excludeEqpId) =>
    api.get('/clients/by-model', { params: { eqpModel, excludeEqpId } }),

  // Config Settings 관리 (agentGroup별)
  getSettingsDocument: (agentGroup) => api.get(`/clients/config/settings/${agentGroup}`),
  saveSettingsDocument: (agentGroup, configFiles) =>
    api.put(`/clients/config/settings/${agentGroup}`, { configFiles }),
}

// Single Client Control API (RPC via ManagerAgent)
export const clientControlApi = {
  // 서비스 상태 조회
  getStatus: (eqpId) =>
    api.get(`/clients/${eqpId}/status`),

  // 서비스 시작
  start: (eqpId) =>
    api.post(`/clients/${eqpId}/start`),

  // 서비스 중지
  stop: (eqpId) =>
    api.post(`/clients/${eqpId}/stop`),

  // 서비스 재시작
  restart: (eqpId) =>
    api.post(`/clients/${eqpId}/restart`),

  // 배치 상태 조회
  getBatchStatus: (eqpIds) =>
    api.post('/clients/batch-status', { eqpIds }),
}

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Strategy-based Service Control API
export const serviceApi = {
  getServiceTypes: () => api.get('/clients/service-types'),
  getClientById: (id, agentGroup) =>
    api.get(`/clients/${id}`, { params: { agentGroup } }),
  executeAction: (eqpId, agentGroup, action, timeout = 40000) =>
    api.post(`/clients/${eqpId}/action/${action}`, { agentGroup }, { timeout }),
  batchExecuteAction: (action, eqpIds, agentGroup, timeout = 75000) =>
    api.post(`/clients/batch-action/${action}`, { eqpIds, agentGroup }, { timeout }),
  batchActionStream: (action, eqpIds, agentGroup) => {
    const token = localStorage.getItem('token')
    return fetch(`${API_BASE}/clients/batch-action-stream/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ eqpIds, agentGroup })
    })
  },
}

// Log Viewer API
export const logApi = {
  getSettings: (agentGroup) => api.get(`/clients/log-settings/${agentGroup}`),
  saveSettings: (agentGroup, data) => api.put(`/clients/log-settings/${agentGroup}`, data),
  getFileList: (eqpId, agentGroup) => api.get(`/clients/${eqpId}/log-files`, { params: { agentGroup } }),
  getFileContent: (eqpId, path) => api.get(`/clients/${eqpId}/log-content`, { params: { path }, timeout: 60000 }),
  deleteFiles: (eqpId, paths) => api.delete(`/clients/${eqpId}/log-files`, { data: { paths } }),
  tailStream: (targets) => {
    const token = localStorage.getItem('token')
    return fetch(`${API_BASE}/clients/log-tail-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targets })
    })
  }
}
