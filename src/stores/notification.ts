import { defineStore } from 'pinia'
import { Howl, Howler } from 'howler'
import axios from 'axios'

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
  soundEnabled?: boolean
  soundUrl?: string
  soundVolume?: number
  soundLoop?: boolean
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [] as Notification[],
    unreadCount: 0,
    loading: false,
    initialized: false,
    currentSound: null as any,
    currentCtx: null as any,
    currentOsc: null as any,
    snoozeMinutes: 5,
    lastIncoming: null as Notification | null,
    isPlaying: false
  }),

  actions: {
    async initialize() {
      if (this.initialized) return

      const { useAuthStore } = await import('./auth')
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
          this.lastIncoming = data.notification
          this.addNotification(data.notification)
          this.playSoundForNotification(data.notification)
        })

        // Fetch initial notifications
        await this.fetchNotifications()
        // Fetch user profile to get snoozeMinutes
        try {
          const { useAuthStore } = await import('./auth')
          const authStore = useAuthStore()
          const res = await axios.get('http://localhost:5000/api/users/me', {
            headers: { Authorization: `Bearer ${authStore.token}` }
          })
          const m = res?.data?.user?.notificationSettings?.snoozeMinutes
          if (typeof m === 'number' && m >= 1) this.snoozeMinutes = m
        } catch (_) {
          /* noop */
        }
        this.initialized = true
      } catch (error) {
        console.error('Error initializing notifications:', error)
      }
    },

    async fetchNotifications() {
      try {
        const { useAuthStore } = await import('./auth')
        const authStore = useAuthStore()
        this.loading = true
        const response = await axios.get('http://localhost:5000/api/notifications', {
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

    playSoundForNotification(notification: Notification) {
      const enabled = notification?.soundEnabled ?? true
      if (!enabled) return
      const url = notification?.soundUrl || ''
      const vol = typeof notification?.soundVolume === 'number' ? notification.soundVolume : 1
      const loop = !!notification?.soundLoop
      try {
        if (url) {
          try {
            if (this.currentSound) {
              this.currentSound.stop()
              this.currentSound = null
            }
          } catch (_) {
            /* noop */
          }
          const sound = new Howl({ src: [url], volume: Math.max(0, Math.min(1, vol)), loop })
          this.currentSound = sound
          this.isPlaying = true
          sound.play()
          if (!loop) {
            setTimeout(() => {
              if (this.currentSound) {
                this.currentSound.stop()
                this.currentSound = null
              }
              this.isPlaying = false
            }, 5000)
          }
        } else {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = 880
          gainNode.gain.value = Math.max(0, Math.min(1, vol))
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)
          oscillator.start()
          this.currentCtx = ctx
          this.currentOsc = oscillator
          this.isPlaying = true
          setTimeout(() => {
            try {
              if (this.currentOsc) {
                this.currentOsc.stop()
                this.currentOsc = null
              } else {
                oscillator.stop()
              }
            } catch (_) {
              /* noop */
            }
            try {
              if (this.currentCtx) {
                this.currentCtx.close()
                this.currentCtx = null
              } else {
                ctx.close()
              }
            } catch (_) {
              /* noop */
            }
            this.isPlaying = false
          }, 1000)
        }
      } catch (_) {
        void 0
      }
    },

    stopSound() {
      try {
        if (this.currentSound) {
          this.currentSound.stop()
          this.currentSound = null
        } else {
          Howler.stop()
        }
        if (this.currentOsc) {
          try {
            this.currentOsc.stop()
          } catch (_) {
            /* noop */
          }
          this.currentOsc = null
        }
        if (this.currentCtx) {
          try {
            this.currentCtx.close()
          } catch (_) {
            /* noop */
          }
          this.currentCtx = null
        }
        this.isPlaying = false
      } catch (_) {
        /* noop */
      }
    },

    async markAsRead(id: string) {
      const { useAuthStore } = await import('./auth')
      const authStore = useAuthStore()
      try {
        await axios.patch(
          `http://localhost:5000/api/notifications/${id}/read`,
          {},
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )

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
      const { useAuthStore } = await import('./auth')
      const authStore = useAuthStore()

      try {
        await axios.patch(
          'http://localhost:5000/api/notifications/read-all',
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
        const { useAuthStore } = await import('./auth')
        const authStore = useAuthStore()
        await axios.delete(`http://localhost:5000/api/notifications/${id}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })

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
        const { useAuthStore } = await import('./auth')
        const authStore = useAuthStore()
        await axios.delete('http://localhost:5000/api/notifications/read', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })
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
