import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const axiosInstance = axios.create({
  baseURL: 'https://ims-api-id38.onrender.com/api'
})

axiosInstance.interceptors.request.use(
  (config) => {
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
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      router.push('/auth/signin')
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
