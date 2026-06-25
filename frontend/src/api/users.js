import api from './axios'

export const listUsers = () => api.get('/users')
export const createUser = (body) => api.post('/users', body)
export const updateUser = (id, body) => api.patch(`/users/${id}`, body)
export const deleteUser = (id) => api.delete(`/users/${id}`)
