import api from './axios'

export const getCurrentSeason = () => api.get('/seasons/current')
export const getSeasons = () => api.get('/seasons')
export const createSeason = (data: unknown) => api.post('/seasons', data)
export const archiveSeason = (id: string) => api.put(`/seasons/${id}/archive`)
export const getSeasonStats = (id: string) => api.get(`/seasons/${id}/stats`)
