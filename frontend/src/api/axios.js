import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

let isRedirecting = false

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (isRedirecting) return Promise.reject(error)
      isRedirecting = true
      localStorage.removeItem('ct_token')
      window.location.replace('/login')
      setTimeout(() => { isRedirecting = false }, 1000)
    }
    return Promise.reject(error)
  }
)

export default api
