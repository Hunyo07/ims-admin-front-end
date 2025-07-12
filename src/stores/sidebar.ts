import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  const isSidebarOpen = ref(false)
  const isFullScreen = ref(false)
  const selected = useStorage('selected', ref('eCommerce'))
  const page = useStorage('page', ref('Dashboard'))

  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  function setFullScreen(value: boolean) {
    isFullScreen.value = value
    // Auto-hide sidebar when entering full screen
    if (value) {
      isSidebarOpen.value = false
    }
  }

  return { isSidebarOpen, isFullScreen, toggleSidebar, setFullScreen, selected, page } 
})
