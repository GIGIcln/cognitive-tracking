import api from './axios'

export const getGroups = () => api.get('/groups')
export const getGroup = (id) => api.get(`/groups/${id}`)
export const createGroup = (data) => api.post('/groups', data)
export const updateGroup = (id, data) => api.patch(`/groups/${id}`, data)
export const deleteGroup = (id) => api.delete(`/groups/${id}`)
export const getGroupTargets = (id, config) => api.get(`/groups/${id}/targets`, config)
export const updateGroupTargets = (id, targets) =>
  api.put(`/groups/${id}/targets`, targets)
export const getGroupHistory = (groupId, limit = 60) =>
  api.get(`/groups/${groupId}/history`, { params: { limit } })
export const getGroupChangelog = (groupId) => api.get(`/groups/${groupId}/changelog`)
export const getGroupAttendance = (groupId, limit = 20) =>
  api.get(`/groups/${groupId}/attendance`, { params: { limit } })
export const getGroupPlayerStats = (groupId) => api.get(`/groups/${groupId}/player_stats`)
