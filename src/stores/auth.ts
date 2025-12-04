import { defineStore } from 'pinia'
import axios from 'axios'

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

    async fetchCurrentUser() {
      try {
        if (!this.token) return null

        const response = await axios.get('http://localhost:5000/api/auth/me', {
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        })

        const userData = response.data.user
        this.setUser(userData)
        return userData
      } catch (error: any) {
        console.error('Failed to fetch current user:', error)
        // If token is invalid, clear auth data
        if (error.response?.status === 401) {
          this.logout()
        }
        return null
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
      // Grant all permissions if "all" is present
      if (this.permissions.includes('all')) return true
      return this.permissions.includes(permission)
    },

    hasAnyPermission(permissions: string[]): boolean {
      if (!this.user || !this.permissions) return false
      // Grant all permissions if "all" is present
      if (this.permissions.includes('all')) return true
      return permissions.some((permission) => this.permissions.includes(permission))
    },

    hasAllPermissions(permissions: string[]): boolean {
      if (!this.user || !this.permissions) return false
      // Grant all permissions if "all" is present
      if (this.permissions.includes('all')) return true
      return permissions.every((permission) => this.permissions.includes(permission))
    },
    hasRole(role: string | string[]): boolean {
      if (!this.user || !this.user.role) return false
      // Get the role name, handling both string and object formats
      const userRole = typeof this.user.role === 'string' ? this.user.role : this.user.role.name
      if (Array.isArray(role)) {
        return role.includes(userRole)
      }
      return userRole === role
    },
    // Check if user has any of the specified roles
    hasAnyRole(roles: string[]): boolean {
      return this.hasRole(roles)
    },
    // Check if user has all specified roles (useful for complex role requirements)
    hasAllRoles(roles: string[]): boolean {
      if (!this.user || !this.user.role) return false

      const userRole = typeof this.user.role === 'string' ? this.user.role : this.user.role.name
      return roles.includes(userRole)
    },
    // Check if user is superadmin
    isSuperAdmin(): boolean {
      return this.hasRole('superadmin')
    },

    // Check if user is admin or superadmin
    isAdmin(): boolean {
      return this.hasAnyRole(['admin', 'superadmin'])
    },

    // Check if user is staff or higher
    isStaff(): boolean {
      return this.hasAnyRole(['staff', 'admin', 'superadmin'])
    },

    // Check if user is customer
    isCustomer(): boolean {
      return this.hasRole('customer')
    },

    // Get user's role name
    getUserRole(): string | null {
      if (!this.user || !this.user.role) return null
      return typeof this.user.role === 'string' ? this.user.role : this.user.role.name
    },

    // Get user's role display name
    getUserRoleDisplayName(): string {
      const role = this.getUserRole()
      if (!role) return 'Unknown'

      const roleNames: { [key: string]: string } = {
        superadmin: 'Super Administrator',
        admin: 'Administrator',
        staff: 'Staff',
        customer: 'Customer'
      }

      return roleNames[role] || role
    },

    // Check if user can access a specific feature
    canAccess(feature: string): boolean {
      const featurePermissions: { [key: string]: string[] } = {
        dashboard: ['view_dashboard_stats'],
        users: ['view_users', 'manage_users'],
        products: ['view_products', 'manage_products'],
        sales: ['view_sales', 'manage_sales', 'use_pos'],
        inventory: ['view_inventory', 'manage_inventory'],
        suppliers: ['view_suppliers', 'manage_suppliers'],
        customers: ['view_customers', 'manage_customers'],
        reports: ['view_reports', 'generate_reports'],
        settings: ['view_settings', 'manage_settings'],
        pos: ['use_pos'],
        barcodes: ['view_barcodes', 'manage_barcodes'],
        activity_logs: ['view_activity_logs']
      }

      const requiredPermissions = featurePermissions[feature] || []
      return this.hasAnyPermission(requiredPermissions)
    },

    // Check if user can perform a specific action
    canPerform(action: string): boolean {
      const actionPermissions: { [key: string]: string[] } = {
        create_user: ['create_users', 'manage_users'],
        edit_user: ['edit_users', 'manage_users'],
        delete_user: ['delete_users', 'manage_users'],
        create_product: ['create_products', 'manage_products'],
        edit_product: ['edit_products', 'manage_products'],
        delete_product: ['delete_products', 'manage_products'],
        create_sale: ['create_sales', 'manage_sales', 'use_pos'],
        edit_sale: ['edit_sales', 'manage_sales'],
        delete_sale: ['delete_sales', 'manage_sales'],
        void_sale: ['void_sales', 'manage_sales'],
        adjust_stock: ['adjust_stock', 'manage_inventory'],
        create_order: ['create_orders', 'manage_orders'],
        approve_order: ['approve_orders', 'manage_orders'],
        export_data: ['export_reports', 'export_sales_data'],
        manage_settings: ['manage_settings'],
        assign_roles: ['assign_roles', 'manage_users'],
        create_customer: ['create_customers', 'manage_customers'],
        edit_customer: ['edit_customers', 'manage_customers'],
        delete_customer: ['delete_customers', 'manage_customers'],
        deactivate_customer: ['deactivate_customers', 'manage_customers']
      }

      const requiredPermissions = actionPermissions[action] || []
      return this.hasAnyPermission(requiredPermissions)
    }
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
    userRole: (state) => {
      if (!state.user || !state.user.role) return null
      return typeof state.user.role === 'string' ? state.user.role : state.user.role.name
    },
    userPermissions: (state) => state.permissions || [],
    userFullName: (state) => {
      if (!state.user) return ''
      return `${state.user.firstName || ''} ${state.user.lastName || ''}`.trim()
    },
    userEmail: (state) => state.user?.email || '',
    userDisplayName: (state) => {
      if (!state.user) return ''
      const fullName = `${state.user.firstName || ''} ${state.user.lastName || ''}`.trim()
      return fullName || state.user.email || 'Unknown User'
    }
  }
})
