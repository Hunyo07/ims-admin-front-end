<script setup>
import { ref } from 'vue';
import emailjs from 'emailjs-com';
import axios from '@/utils/axios';

const email = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

// TODO: Replace with your actual EmailJS values
const EMAILJS_SERVICE_ID = 'service_5b24ron';
const EMAILJS_TEMPLATE_ID = 'template_rz90ybf';
const EMAILJS_USER_ID = '2ek36LtfO7AEau2wp'; // public key
const FRONTEND_URL = 'http://localhost:5173'; // or your deployed frontend URL

// For demo: generate a random token (in production, the backend should generate the token and send the email)
function generateToken() {
  return Math.random().toString(36).substr(2) + Date.now().toString(36);
}

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const response = await axios.post('/auth/forgot-password', { email: email.value });
    const token = response.data.token;
    const resetLink = `${FRONTEND_URL}/reset-password/${token}`;
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        user_email: email.value,
        reset_link: resetLink,
      },
      EMAILJS_USER_ID
    );
    success.value = 'If an account with that email exists, a password reset link has been sent.';
    email.value = '';
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) {
      error.value = err.response.data.message;
    } else { error.value = 'Failed to send reset email.';
  }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-boxdark">
    <div class="w-full max-w-md p-8 bg-white rounded shadow-md dark:bg-boxdark">
      <h2 class="text-2xl font-bold mb-6 text-center">Forgot Password</h2>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="bg-red-100 text-red-700 p-2 rounded">{{ error }}</div>
        <div v-if="success" class="bg-green-100 text-green-700 p-2 rounded">{{ success }}</div>
        <div>
          <label class="block mb-1 font-medium">Email Address</label>
          <input v-model="email" type="email" class="w-full border border-stroke rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2 rounded hover:bg-opacity-90" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>
      <div class="mt-4 text-xs text-gray-500">
        <p>Note: This form uses <a href="https://www.emailjs.com/" target="_blank" class="text-primary underline">EmailJS</a>. Configure your service/template/user IDs in the code. Your template should use <code>{{reset_link}}</code> for the reset link.</p>
      </div>
    </div>
  </div>
</template> 