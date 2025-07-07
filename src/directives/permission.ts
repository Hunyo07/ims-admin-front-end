import { useAuthStore } from '@/stores/auth'

export const vPermission = {
  mounted(el: HTMLElement, binding: any) {
    const authStore = useAuthStore()
    const { value } = binding
    
    const hasPermission = Array.isArray(value)
      ? value.some(permission => authStore.hasPermission(permission))
      : authStore.hasPermission(value)
    
    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  }
}

export const vRole = {
  mounted(el: HTMLElement, binding: any) {
    const authStore = useAuthStore()
    const { value } = binding
    
    const hasRole = Array.isArray(value)
      ? value.some(role => authStore.hasRole(role))
      : authStore.hasRole(value)
    
    if (!hasRole) {
      el.parentNode?.removeChild(el)
    }
  }
}
