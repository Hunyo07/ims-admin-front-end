<script setup >
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
// import { useNotificationStore } from './stores/notification'
import { useAuthStore } from '@/stores'

// const notificationStore = useNotificationStore()
const authStore = useAuthStore()

onMounted(() => {
  // Initialize notifications if user is authenticated
  if (authStore.isAuthenticated) {
    console.log('User is authenticated')
  }
})
</script>

<template>
  <RouterView />
</template>
