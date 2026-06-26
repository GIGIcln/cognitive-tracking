import api from './axios'

export const listInjuries = (playerId: string) => api.get(`/injury-logs/player/${playerId}`)
export const createInjury = (playerId: string, body: unknown) => api.post(`/injury-logs/player/${playerId}`, body)
export const updateInjury = (injuryId: string, body: unknown) => api.patch(`/injury-logs/${injuryId}`, body)
export const deleteInjury = (injuryId: string) => api.delete(`/injury-logs/${injuryId}`)
