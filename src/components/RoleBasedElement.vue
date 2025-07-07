<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const props = defineProps({
  roles: {
    type: Array as () => string[],
    default: () => []
  },
  permissions: {
    type: Array as () => string[],
    default: () => []
  }
})

const authStore = useAuthStore()

const hasAccess = computed(() => {
  // If no roles or permissions specified, deny access
  if (props.roles.length === 0 && props.permissions.length === 0) return false

  // Check roles
  const hasRole = props.roles.length === 0 || authStore.hasRole(props.roles)

  // Check permissions
  const hasPermission =
    props.permissions.length === 0 ||
    props.permissions.every((permission) => authStore.hasPermission(permission))

  return hasRole && hasPermission
})
</script>

<template>
  <div v-if="hasAccess">
    <slot></slot>
  </div>
</template>
