<script setup >
import { useAuthStore } from '@/stores'
import { computed } from 'vue'

const props = defineProps({
  roles: {
    type: Array ,
    default: () => []
  },
  permissions: {
    type: Array ,
    default: () => []
  },
  requireAllPermissions: {
    type: Boolean,
    default: false
  },
  requireAllRoles: {
    type: Boolean,
    default: false
  },
  showFallback: {
    type: Boolean,
    default: false
  },
  fallbackMessage: {
    type: String,
    default: 'Access Denied'
  },
  fallbackClass: {
    type: String,
    default: 'text-red-500 text-sm'
  }
})

const authStore = useAuthStore()

const hasAccess = computed(() => {
  // If no roles or permissions specified, deny access
  if (props.roles.length === 0 && props.permissions.length === 0) return false

  // Check roles
  let hasRole = true
  if (props.roles.length > 0) {
    if (props.requireAllRoles) {
      hasRole = authStore.hasAllRoles(props.roles)
    } else {
      hasRole = authStore.hasRole(props.roles)
    }
  }

  // Check permissions
  let hasPermission = true
  if (props.permissions.length > 0) {
    if (props.requireAllPermissions) {
      hasPermission = authStore.hasAllPermissions(props.permissions)
    } else {
      hasPermission = authStore.hasAnyPermission(props.permissions)
    }
  }

  return hasRole && hasPermission
})

const accessDenied = computed(() => {
  return !hasAccess.value && props.showFallback
})
</script>

<template>
  <div v-if="hasAccess">
    <slot></slot>
  </div>
  <div v-else-if="accessDenied" :class="fallbackClass">
    {{ fallbackMessage }}
  </div>
</template>
