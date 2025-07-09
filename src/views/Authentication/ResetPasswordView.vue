<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/axios.js';

const route = useRoute();
const router = useRouter();
const token = ref(route.params.token || route.query.token || '');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  success.value = '';
  if (!password.value || password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    loading.value = false;
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    loading.value = false;
    return;
  }
  try {
    await api.post('/auth/reset-password', {
      token: token.value,
      password: password.value,
    });
    success.value = 'Password reset successful! You can now log in.';
    setTimeout(() => router.push('/'), 2000);
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to reset password.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-boxdark">
    <div class="w-full max-w-md p-8 bg-white rounded shadow-md dark:bg-boxdark">
      <h2 class="text-2xl font-bold mb-6 text-center">Reset Password</h2>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="bg-red-100 text-red-700 p-2 rounded">{{ error }}</div>
        <div v-if="success" class="bg-green-100 text-green-700 p-2 rounded">{{ success }}</div>
        <div>
          <label class="block mb-1 font-medium">New Password</label>
          <input v-model="password" type="password" class="w-full border border-stroke rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
        </div>
        <div>
          <label class="block mb-1 font-medium">Confirm Password</label>
          <input v-model="confirmPassword" type="password" class="w-full border border-stroke rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2 rounded hover:bg-opacity-90" :disabled="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
    </div>
  </div>
</template> 