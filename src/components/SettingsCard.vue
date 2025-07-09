<script setup>
import { ref, onMounted } from 'vue';
import api from '@/utils/axios.js';

const loading = ref(false);
const error = ref('');
const success = ref('');

const formData = ref({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  password: '',
  age: '',
  gender: '',
  civilStatus: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: '',
  },
});

const fetchProfile = async () => {
  loading.value = true;
  error.value = '';
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = res.data.user;
    formData.value.firstName = user.firstName || '';
    formData.value.lastName = user.lastName || '';
    formData.value.phoneNumber = user.phoneNumber || '';
    formData.value.email = user.email || '';
    formData.value.password = '';
    formData.value.age = user.age || '';
    formData.value.gender = user.gender || '';
    formData.value.civilStatus = user.civilStatus || '';
    formData.value.address = {
      street: user.address?.street || '',
      barangay: user.address?.barangay || '',
      city: user.address?.city || '',
      province: user.address?.province || '',
      zipCode: user.address?.zipCode || '',
    };
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load user data.';
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const token = localStorage.getItem('token');
    const updateData = { ...formData.value, address: { ...formData.value.address } };
    if (!updateData.password) delete updateData.password;
    const res = await api.patch('/users/me', updateData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = res.data.user;
    formData.value.firstName = user.firstName || '';
    formData.value.lastName = user.lastName || '';
    formData.value.phoneNumber = user.phoneNumber || '';
    formData.value.email = user.email || '';
    formData.value.password = '';
    formData.value.age = user.age || '';
    formData.value.gender = user.gender || '';
    formData.value.civilStatus = user.civilStatus || '';
    formData.value.address = {
      street: user.address?.street || '',
      barangay: user.address?.barangay || '',
      city: user.address?.city || '',
      province: user.address?.province || '',
      zipCode: user.address?.zipCode || '',
    };
    success.value = 'Account settings updated successfully!';
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to update account settings.';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchProfile);
</script>

<template>
  <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark max-w-xl mx-auto p-8 mt-8">
    <h3 class="font-medium text-black dark:text-white mb-6 text-2xl text-center">Account Settings</h3>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div v-if="error" class="bg-red-100 text-red-700 p-2 rounded">{{ error }}</div>
      <div v-if="success" class="bg-green-100 text-green-700 p-2 rounded">{{ success }}</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="firstName">First Name</label>
          <input v-model="formData.firstName" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="firstName" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="lastName">Last Name</label>
          <input v-model="formData.lastName" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="lastName" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="phoneNumber">Phone Number</label>
          <input v-model="formData.phoneNumber" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="phoneNumber" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="email">Email</label>
          <input v-model="formData.email" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="email" id="email" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="age">Age</label>
          <input v-model="formData.age" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="number" id="age" min="0" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="gender">Gender</label>
          <select v-model="formData.gender" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" id="gender">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="civilStatus">Civil Status</label>
          <select v-model="formData.civilStatus" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" id="civilStatus">
            <option value="">Select</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
        <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="street">Street</label>
            <input v-model="formData.address.street" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="street" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="barangay">Barangay</label>
            <input v-model="formData.address.barangay" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="barangay" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="city">City</label>
            <input v-model="formData.address.city" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="city" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="province">Province</label>
            <input v-model="formData.address.province" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="province" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="zipCode">Zip Code</label>
            <input v-model="formData.address.zipCode" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="text" id="zipCode" />
          </div>
        </div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="password">Password <span class="text-xs text-gray-500">(leave blank to keep current)</span></label>
          <input v-model="formData.password" class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary" type="password" id="password" autocomplete="new-password" />
        </div>
      </div>
      <button type="submit" class="mt-4 w-full bg-primary text-white py-2 rounded hover:bg-opacity-90" :disabled="loading">
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </form>
  </div>
</template>
