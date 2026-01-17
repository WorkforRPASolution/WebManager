import api from '../../shared/api'

export const usersApi = {
  // 유저 목록 조회
  getUsers: (params) => api.get('/users', { params }),

  // 역할 목록 조회
  getRoles: () => api.get('/users/roles'),

  // 유저 상세 조회
  getUser: (id) => api.get(`/users/${id}`),

  // 유저 생성
  createUser: (data) => api.post('/users', data),

  // 유저 수정
  updateUser: (id, data) => api.put(`/users/${id}`, data),

  // 유저 삭제
  deleteUser: (id) => api.delete(`/users/${id}`),

  // 다중 유저 삭제
  deleteUsers: (ids) => api.delete('/users', { data: { ids } })
}
