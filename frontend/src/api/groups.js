import api from './axios'

export const getGroups = () => api.get('/groups')
export const getGroup = (id) => api.get(`/groups/${id}`)
export const getGroupTargets = (id) => api.get(`/groups/${id}/targets`)
export const updateGroupTargets = (id, targets) =>
  api.put(`/groups/${id}/targets`, targets)
