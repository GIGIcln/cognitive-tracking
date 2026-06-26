import api from './axios'

export const listUsers = () => api.get('/users')
export const createUser = (body: unknown) => api.post('/users', body)
export const updateUser = (id: string, body: unknown) => api.patch(`/users/${id}`, body)
export const deleteUser = (id: string) => api.delete(`/users/${id}`)
