import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    permissions: JSON.parse(localStorage.getItem('permissions') || '[]')
  }),

  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem('token', token)
    },

    setUser(user: any) {
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
      
      // Extract permissions from user role if available
      if (user?.role?.permissions) {
        this.permissions = user.role.permissions
        localStorage.setItem('permissions', JSON.stringify(user.role.permissions))
      } else if (user?.permissions) {
        // Handle case where permissions might be directly on the user object
        this.permissions = user.permissions
        localStorage.setItem('permissions', JSON.stringify(user.permissions))
      }
    },

    logout() {
      this.token = null
      this.user = null
      this.permissions = []
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('permissions')
    },

    hasPermission(permission: string): boolean {
      if (!this.user || !this.permissions) return false
      return this.permissions.includes(permission)
    },

    hasRole(role: string | string[]): boolean {
      if (!this.user || !this.user.role) return false

      // Get the role name, handling both string and object formats
      const userRole = typeof this.user.role === 'string' ? this.user.role : this.user.role.name

      if (Array.isArray(role)) {
        return role.includes(userRole)
      }

      return userRole === role
    }
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
    userRole: (state) => {
      if (!state.user || !state.user.role) return null
      return typeof state.user.role === 'string' ? state.user.role : state.user.role.name
    },
    userPermissions: (state) => state.permissions || []
  }
})
