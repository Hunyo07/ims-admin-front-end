<script setup lang="ts">
import { useAuthStore } from '../stores'
import { computed } from 'vue'

const props = defineProps({
  roles: {
    type: Array as () => string[],
    default: () => []
  },
  permissions: {
    type: Array as () => string[],
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
  disabled: {
    type: Boolean,
    default: false
  },
  disabledClass: {
    type: String,
    default: 'opacity-50 cursor-not-allowed'
  },
  tooltip: {
    type: String,
    default: 'Insufficient permissions'
  },
  showTooltip: {
    type: Boolean,
    default: true
  }
})

const authStore = useAuthStore()

const hasAccess = computed(() => {
  // If no roles or permissions specified, allow access
  if (props.roles.length === 0 && props.permissions.length === 0) return true

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

const isDisabled = computed(() => {
  return props.disabled || !hasAccess.value
})

const buttonClass = computed(() => {
  return isDisabled.value ? props.disabledClass : ''
})

const title = computed(() => {
  if (!hasAccess.value && props.showTooltip) {
    return props.tooltip
  }
  return ''
})
</script>

<template>
  <button
    :disabled="isDisabled"
    :class="buttonClass"
    :title="title"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template> 