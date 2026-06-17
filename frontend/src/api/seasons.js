import api from './axios'

export const getCurrentSeason = () => api.get('/seasons/current')
export const getSeasons = () => api.get('/seasons')
export const createSeason = (data) => api.post('/seasons', data)
export const archiveSeason = (id) => api.put(`/seasons/${id}/archive`)
