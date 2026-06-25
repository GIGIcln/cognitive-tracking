import api from './axios'

export const listInjuries = (playerId) => api.get(`/injury-logs/player/${playerId}`)
export const createInjury = (playerId, body) => api.post(`/injury-logs/player/${playerId}`, body)
export const updateInjury = (injuryId, body) => api.patch(`/injury-logs/${injuryId}`, body)
export const deleteInjury = (injuryId) => api.delete(`/injury-logs/${injuryId}`)
