import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const response = await api.post('/auth/refresh-token')
        const { token } = response.data

        // Update stored token
        localStorage.setItem('token', token)

        // Update authorization header
        originalRequest.headers['Authorization'] = `Bearer ${token}`

        // Retry original request
        return api(originalRequest)
      } catch (refreshError) {
        // Handle refresh token failure (e.g., redirect to login)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
