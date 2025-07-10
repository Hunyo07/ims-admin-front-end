import { ref, watch, nextTick } from 'vue'
import { defineStore } from 'pinia'

export const useDarkModeStore = defineStore('darkMode', () => {
  // Get initial value from localStorage safely
  const getInitialDarkMode = () => {
    try {
      const stored = localStorage.getItem('darkMode')
      return stored ? JSON.parse(stored) : false
    } catch {
      return false
    }
  }

  const darkMode = ref(getInitialDarkMode())

  // Watch for changes and update DOM and localStorage
  watch(darkMode, (newValue) => {
    try {
      localStorage.setItem('darkMode', JSON.stringify(newValue))
      // Defer DOM manipulation to ensure document is ready
      nextTick(() => {
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.classList.toggle('dark', newValue)
        }
      })
    } catch (error) {
      console.warn('Failed to save dark mode preference:', error)
    }
  }, { immediate: false }) // Changed to false to avoid immediate execution

  // Initialize dark mode after component is mounted
  function initializeDarkMode() {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', darkMode.value)
    }
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
  }

  return { darkMode, toggleDarkMode, initializeDarkMode }
})
