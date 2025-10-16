import axios from 'axios'
import router from '../router'

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api'
})

axiosInstance.interceptors.request.use(
  async (config) => {
    const { useAuthStore } = await import('../stores/auth')
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { useAuthStore } = await import('../stores/auth')
      const authStore = useAuthStore()
      authStore.logout()
      router.push('/auth/signin')
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
