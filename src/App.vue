<script setup >
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useNotificationStore } from './stores/notification'
import { useAuthStore } from './stores/auth'

const notificationStore = useNotificationStore()
const authStore = useAuthStore()

onMounted(() => {
  // Initialize notifications if user is authenticated
  if (authStore.isAuthenticated) {
    notificationStore.initialize()
  }
})
</script>

<template>
  <RouterView />
</template>
