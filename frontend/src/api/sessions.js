import api from './axios'

export const getSessions = (groupId, limit) =>
  api.get('/sessions', { params: { ...(groupId ? { group_id: groupId } : {}), ...(limit ? { limit } : {}) } })

export const createSession = (data) => api.post('/sessions', data)
export const deleteSession = (id) => api.delete(`/sessions/${id}`)
export const getSession = (id) => api.get(`/sessions/${id}`)
export const saveMeasurements = (sessionId, measurements) =>
  api.post(`/sessions/${sessionId}/measurements`, { measurements })
export const getMeasurements = (sessionId) =>
  api.get(`/sessions/${sessionId}/measurements`)
export const getSessionAverages = (sessionId, config) =>
  api.get(`/sessions/${sessionId}/averages`, config)
export const getSessionRankings = (sessionId, config) =>
  api.get(`/sessions/${sessionId}/rankings`, config)
