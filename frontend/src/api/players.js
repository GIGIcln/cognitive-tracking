import api from './axios'

export const getPlayers = (groupId) =>
  api.get('/players', { params: groupId ? { group_id: groupId } : {} })

export const createPlayer = (data) => api.post('/players', data)
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data)
export const assignPlayer = (id, groupId) =>
  api.post(`/players/${id}/assign`, { group_id: groupId })
