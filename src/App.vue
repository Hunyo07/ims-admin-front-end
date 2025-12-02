<script setup>
import { RouterView } from 'vue-router'
import { onMounted, watch } from 'vue'
import { useNotificationStore } from './stores/notification'
import { useAuthStore } from '@/stores'

const notificationStore = useNotificationStore()
const authStore = useAuthStore()

onMounted(() => {
  // Initialize notifications if user is authenticated
  if (authStore.isAuthenticated) {
    notificationStore.initialize()
  }
})

watch(
  () => authStore.isAuthenticated,
  (isAuth) => {
    if (isAuth) {
      notificationStore.initialize()
    }
  }
)
</script>

<template>
  <RouterView />
</template>
