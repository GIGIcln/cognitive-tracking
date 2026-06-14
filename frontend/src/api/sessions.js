import api from './axios'

export const getSessions = (groupId) =>
  api.get('/sessions', { params: groupId ? { group_id: groupId } : {} })

export const createSession = (data) => api.post('/sessions', data)
export const getSession = (id) => api.get(`/sessions/${id}`)
export const saveMeasurements = (sessionId, measurements) =>
  api.post(`/sessions/${sessionId}/measurements`, { measurements })
export const getMeasurements = (sessionId) =>
  api.get(`/sessions/${sessionId}/measurements`)
