import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './auth'

// const authStore = useAuthStore()

interface Notification {
  _id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  createdAt: string
  link?: string
  relatedModel?: string
  relatedId?: string
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [] as Notification[],
    unreadCount: 0,
    loading: false,
    initialized: false
  }),

  actions: {
    async initialize() {
      if (this.initialized) return

      const authStore = useAuthStore()

      if (!authStore.isAuthenticated || !authStore.user?.id) {
        console.log('User not authenticated, skipping notification initialization')
        return
      }

      try {
        // Dynamically import socket to avoid circular dependency
        const { socket } = await import('../socket')
        // Authenticate socket with user ID
        socket.emit('authenticate', authStore.user.id)
        // console.log('Socket authenticated for user:', authStore.user.id)

        // Listen for new notifications
        socket.on('newNotification', (data) => {
          console.log('New notification received:', data)
          this.addNotification(data.notification)
        })

        // Fetch initial notifications
        await this.fetchNotifications()
        this.initialized = true
      } catch (error) {
        console.error('Error initializing notifications:', error)
      }
    },

    async fetchNotifications() {
      try {
        const authStore = useAuthStore()
        this.loading = true
        const response = await axios.get('https://ims-api-id38.onrender.com/api/notifications', {
          params: { limit: 10 },
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })
        this.notifications = response.data.data.notifications
        this.unreadCount = response.data.data.unreadCount
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        this.loading = false
      }
    },

    addNotification(notification: Notification) {
      this.notifications = [notification, ...this.notifications]
      if (!notification.isRead) {
        this.unreadCount++
      }
    },

    async markAsRead(id: string) {
      const authStore = useAuthStore()
      try {
        await axios.patch(`https://ims-api-id38.onrender.com/notifications/${id}/read`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })

        const notification = this.notifications.find((n) => n._id === id)
        if (notification && !notification.isRead) {
          notification.isRead = true
          this.unreadCount--
        }
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    },

    async markAllAsRead() {
      const authStore = useAuthStore()

      try {
        await axios.patch(
          'https://ims-api-id38.onrender.com/api/notifications/read-all',
          {},
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )
        this.notifications.forEach((notification) => {
          notification.isRead = true
        })
        this.unreadCount = 0
      } catch (error) {
        console.error('Error marking all notifications as read:', error)
      }
    },

    async deleteNotification(id: string) {
      try {
        const authStore = useAuthStore()
        await axios.delete(
          `https://ims-api-id38.onrender.com/api/notifications/${id}`,
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )

        const index = this.notifications.findIndex((n) => n._id === id)
        if (index !== -1) {
          const notification = this.notifications[index]
          this.notifications.splice(index, 1)

          if (!notification.isRead) {
            this.unreadCount--
          }
        }
      } catch (error) {
        console.error('Error deleting notification:', error)
      }
    },

    async deleteAllRead() {
      try {
        const authStore = useAuthStore()
        await axios.delete(
          'https://ims-api-id38.onrender.com/api/notifications/read',
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )
        this.notifications = this.notifications.filter((n) => !n.isRead)
      } catch (error) {
        console.error('Error deleting read notifications:', error)
      }
    },

    reset() {
      this.notifications = []
      this.unreadCount = 0
      this.initialized = false
    }
  }
})
