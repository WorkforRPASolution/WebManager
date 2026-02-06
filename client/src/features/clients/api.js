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
  getSettings: () => api.get('/clients/config/settings'),

  // 4개 Config 파일 일괄 읽기
  getConfigs: (eqpId) => api.get(`/clients/${eqpId}/config`, { timeout: 60000 }),

  // 단일 Config 파일 저장
  updateConfig: (eqpId, fileId, content) =>
    api.put(`/clients/${eqpId}/config/${fileId}`, { content }, { timeout: 60000 }),

  // 횡전개 대상 Client 목록 (같은 eqpModel)
  getClientsByModel: (eqpModel, excludeEqpId) =>
    api.get('/clients/by-model', { params: { eqpModel, excludeEqpId } }),
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
}
