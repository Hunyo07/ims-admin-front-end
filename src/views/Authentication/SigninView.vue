<script setup >
import DefaultAuthCard from '../../components/Auths/DefaultAuthCard.vue'
import InputGroup from '../../components/Auths/InputGroup.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'


import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores'

const router = useRouter()
const authStore = useAuthStore()

const pageTitle = ref('Sign In')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleSubmit = async (e) => {
  e.preventDefault()
  errorMessage.value = ''
  isLoading.value = true

  try {
    const response = await axios.post('https://ims-api-id38.onrender.com/api/auth/signin', {
    // const response = await axios.post('https://ims-api-id38.onrender.com/api/auth/signin', {
      email: email.value,
      password: password.value
    })
    
    const { token, user } = response.data
    // Store auth data
    authStore.setToken(token)
    authStore.setUser(user)

    // Redirect based on role\
    
    switch (user.role.name) {
      case 'superadmin':
        router.push('/eCommerce')
        break
      case 'admin':
        router.push('/eCommerce')
        break
      case 'staff':
        router.push('/pos')
        break
      default:
        router.push('/')
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Login failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 dark:bg-boxdark sm:px-6 lg:px-8"
  >
    <DefaultAuthCard subtitle="" title="Inventory Management System">
      <form @submit="handleSubmit" class="space-y-6">
        <InputGroup
          label="Email Address"
          type="email"
          placeholder="Enter your email"
          v-model="email"
          required
          class="mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        </InputGroup>

        <InputGroup
          label="Password"
          type="password"
          placeholder="Enter your password"
          v-model="password"
          required
          class="mb-6"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clip-rule="evenodd"
            />
          </svg>
        </InputGroup>
        <!-- Forgot Password Link -->
        <div class="mb-4 text-right">
          <router-link to="/forgot-password" class="text-primary hover:underline text-sm">
            Forgot Password?
          </router-link>
        </div>
        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="mb-4 flex items-center rounded-lg border border-danger-200 bg-danger-50 p-4 text-danger-700 dark:border-danger-900 dark:bg-danger-900/30 dark:text-danger-400"
        >
          <svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            />
          </svg>
          {{ errorMessage }}
        </div>

        <div>
          <button
            type="submit"
            :disabled="isLoading"
            class="group relative flex w-full justify-center rounded-lg bg-rose-400 px-4 py-3 text-sm font-medium text-white transition hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-boxdark"
          >
            <span class="absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                v-if="!isLoading"
                class="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <svg v-else class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
            {{ isLoading ? 'Signing in...' : 'Sign In' }}
          </button>
        </div>
      </form>
    </DefaultAuthCard>
  </div>
</template>
