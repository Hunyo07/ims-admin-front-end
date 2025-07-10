<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Customer interfaces
interface Address {
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
}

interface GcashDetails {
  accountName: string
  accountNumber: string
}

interface Customer {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  address: Address
  gcashDetails?: GcashDetails
  preferredDeliveryTime?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Update refs
const customers = ref<Customer[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const showModal = ref(false)
const isDeleting = ref(false)
const isTogglingStatus = ref(false)
const selectedCustomerId = ref(null)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isEditing = ref(false)
const editingCustomer = ref(null)
const isSubmitting = ref(false)
const newCustomer = ref({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  },
  gcashDetails: {
    accountName: '',
    accountNumber: ''
  },
  preferredDeliveryTime: ''
})

// Update computed properties
const filteredCustomers = computed(() => {
  return customers.value.filter((customer) => {
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchQuery.value.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      customer.phoneNumber.includes(searchQuery.value)
    return matchesSearch
  })
})

const fetchCustomers = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('https://ims-api-id38.onrender.com/api/customers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    customers.value = response.data.customers || response.data
  } catch (error) {
    console.error('Error fetching customers:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching customers'
    })
  } finally {
    isLoading.value = false
  }
}

const paginatedCustomers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCustomers.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredCustomers.value.length / itemsPerPage.value))
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newCustomer.value).some((key) => newCustomer.value[key] !== '')
})

const handleCloseModal = async () => {
  if (hasUnsavedChanges.value) {
    const result = await Swal.fire({
      title: 'Unsaved Changes',
      text: 'You have unsaved changes. Are you sure you want to close?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, discard changes',
      cancelButtonText: 'No, keep editing',
      customClass: {
        confirmButton:
          'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
        cancelButton:
          'swal2-cancel bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
      }
    })
    if (!result.isConfirmed) return
  }

  showModal.value = false
  resetForm()
}

// Edit and delete functions
const handleEditCustomer = (customer) => {
  isEditing.value = true
  editingCustomer.value = customer
  newCustomer.value = { ...customer }
  showModal.value = true
}

const handleToggleCustomerStatus = async (customer) => {
  const action = customer.isActive ? 'deactivate' : 'activate'
  const result = await Swal.fire({
    title: `Are you sure?`,
    text: `Do you want to ${action} ${customer.firstName} ${customer.lastName}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: `Yes, ${action} customer!`,
    customClass: {
      confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
      cancelButton: 'swal2-cancel bg-danger text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
    }
  })

  if (result.isConfirmed) {
    try {
      isTogglingStatus.value = true
      selectedCustomerId.value = customer._id
      const response = await axios.patch(`https://ims-api-id38.onrender.com/api/customers/${customer._id}/toggle-status`, {}, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      
      // Update the customer in the local array with the response data
      const updatedCustomer = response.data.customer
      customers.value = customers.value.map(c => 
        c._id === customer._id ? updatedCustomer : c
      )
      
      // Emit socket event for real-time update
      socket.emit('customerStatusToggled', updatedCustomer)
      
      Swal.fire(
        'Success!', 
        `Customer has been ${action}d.`, 
        'success'
      )
    } catch (error) {
      console.error('Error toggling customer status:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || `Error ${action}ing customer`
      })
    } finally {
      isTogglingStatus.value = false
      selectedCustomerId.value = null
    }
  }
}

const handleDeleteCustomer = async (customerId) => {
  selectedCustomerId.value = customerId
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!',
    customClass: {
      confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
      cancelButton: 'swal2-cancel bg-danger text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
    }
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      await axios.delete(`https://ims-api-id38.onrender.com/api/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      socket.emit('deleteCustomer', customerId)
      Swal.fire('Deleted!', 'Customer has been deleted.', 'success')
      customers.value = customers.value.filter(customer => customer._id !== customerId)
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting customer'
      })
    } finally {
      isDeleting.value = false
      selectedCustomerId.value = null
    }
  }
}

const handleAddCustomer = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post(
      'https://ims-api-id38.onrender.com/api/customers/register',
      newCustomer.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    socket.emit('createCustomer', response.data.customer)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Customer created successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating customer'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateCustomer = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.put(
      `https://ims-api-id38.onrender.com/api/customers/${editingCustomer.value._id}`,
      newCustomer.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const updatedCustomer = response.data.customer
    customers.value = customers.value.map((customer) =>
      customer._id === updatedCustomer._id ? updatedCustomer : customer
    )

    socket.emit('updateCustomer', updatedCustomer)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Customer updated successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating customer'
    })
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  newCustomer.value = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: {
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: ''
    },
    gcashDetails: {
      accountName: '',
      accountNumber: ''
    },
    preferredDeliveryTime: ''
  }
  isEditing.value = false
}

onMounted(() => {
  fetchCustomers()

  // Ensure socket is connected
  if (!socket.connected) {
    socket.connect()
  }

  // Socket listeners for real-time updates
  socket.on('customerCreated', (newCustomer) => {
    if (newCustomer && newCustomer._id) {
      const exists = customers.value.some((customer) => customer._id === newCustomer._id)
      if (!exists) {
        customers.value = [newCustomer, ...customers.value]
      }
    }
  })
  
  socket.on('customerUpdated', (updatedCustomer) => {
    if (updatedCustomer && updatedCustomer._id) {
      customers.value = customers.value.map((customer) =>
        customer._id === updatedCustomer._id ? updatedCustomer : customer
      )
    }
  })

  socket.on('customerStatusToggled', (updatedCustomer) => {
    if (updatedCustomer && updatedCustomer._id) {
      customers.value = customers.value.map((customer) =>
        customer._id === updatedCustomer._id ? updatedCustomer : customer
      )
    }
  })

  socket.on('customerDeleted', (customerId) => {
    if (customerId) {
      customers.value = customers.value.filter((customer) => customer._id !== customerId)
    }
  })

  // Cleanup on component unmount
  return () => {
    socket.off('customerCreated')
    socket.off('customerUpdated')
    socket.off('customerStatusToggled')
    socket.off('customerDeleted')
  }
})
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="p-4 md:p-6 xl:p-7.5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h4 class="text-xl font-bold text-black dark:text-white">Customer List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search customers..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 outline-none focus:border-primary dark:border-strokedark"
            />
            <span class="absolute left-4 top-1/2 -translate-y-1/2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 fill-current text-bodydark2"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </div>

          <button
            @click="fetchCustomers"
            class="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 mr-2"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Loading...' : 'Refresh' }}
          </button>
          <button
            v-if="authStore.canPerform('create_customer')"
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Register Customer
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="max-w-full overflow-x-auto">
      <table class="w-full table-auto">
        <!-- Update the table headers -->
        <thead>
          <tr class="bg-gray-2 text-left dark:bg-meta-4">
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Customer Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Email</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Phone Number</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Address</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Preferred Delivery</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white" v-if="authStore.canPerform('edit_customer')">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="7" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedCustomers.length === 0">
            <td colspan="7" class="text-center py-4">No customers found</td>
          </tr>
          <tr
            v-for="customer in paginatedCustomers"
            :key="customer._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  {{ customer.firstName.charAt(0).toUpperCase() }}{{ customer.lastName.charAt(0).toUpperCase() }}
                </div>
                <p class="text-black dark:text-white">{{ customer.firstName }} {{ customer.lastName }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ customer.email }}</td>
            <td class="py-4.5 px-4">{{ customer.phoneNumber }}</td>
            <td class="py-4.5 px-4">
              <div class="text-sm">
                <p>{{ customer.address.street }},</p>
                <p>{{ customer.address.barangay }},</p>
                <p>{{ customer.address.city }}, {{ customer.address.province }}</p>
                <p>{{ customer.address.zipCode }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <span 
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  customer.isActive 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                ]"
              >
                {{ customer.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="py-4.5 px-4">
              {{ customer.preferredDeliveryTime || 'Not specified' }}
            </td>
                        <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button v-if="authStore.canPerform('edit_customer')" @click="handleEditCustomer(customer)" class="hover:text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                    />
                  </svg>
                </button>

                <button
                  v-if="authStore.canPerform('deactivate_customer')"
                  @click="handleToggleCustomerStatus(customer)"
                  class="hover:text-warning"
                  :disabled="isTogglingStatus && selectedCustomerId === customer._id"
                  :title="customer.isActive ? 'Deactivate Customer' : 'Activate Customer'"
                >
                  <svg
                    v-if="!(isTogglingStatus && selectedCustomerId === customer._id)"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      v-if="customer.isActive"
                      fill-rule="evenodd"
                      d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                      clip-rule="evenodd"
                    />
                    <path
                      v-else
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <svg
                    v-else
                    class="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </button>
          
                <button
                  v-if="authStore.canPerform('delete_customer')"
                  @click="handleDeleteCustomer(customer._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedCustomerId === customer._id"
                >
                <svg
                    v-if="!(isDeleting && selectedCustomerId === customer._id)"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <svg
                    v-else
                    class="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center justify-between p-4">
        <div class="flex items-center gap-2">
          <select
            v-model="itemsPerPage"
            class="rounded border border-stroke bg-transparent px-2 py-1"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
          <span>Items per page</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Customer Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div class="relative w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">{{ isEditing ? 'Update Customer' : 'Register Customer' }}</h3>
          <button
            @click="handleCloseModal"
            class="hover:text-danger"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          @submit.prevent="isEditing ? handleUpdateCustomer() : handleAddCustomer()"
          class="space-y-6"
        >
          <!-- Personal Information -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >First Name <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.firstName"
                type="text"
                required
                placeholder="Enter first name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Last Name <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.lastName"
                type="text"
                required
                placeholder="Enter last name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <!-- Contact Information -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Email <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.email"
                type="email"
                required
                placeholder="Enter email address"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Phone Number <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.phoneNumber"
                type="tel"
                required
                placeholder="Enter phone number"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <!-- Address Information -->
          <div class="space-y-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Street Address <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.address.street"
                type="text"
                required
                placeholder="Enter street address"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Barangay <span class="text-danger">*</span></label
              >
              <input
                v-model="newCustomer.address.barangay"
                type="text"
                required
                placeholder="Enter barangay"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white"
                  >City <span class="text-danger">*</span></label
                >
                <input
                  v-model="newCustomer.address.city"
                  type="text"
                  required
                  placeholder="Enter city"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white"
                  >Province <span class="text-danger">*</span></label
                >
                <input
                  v-model="newCustomer.address.province"
                  type="text"
                  required
                  placeholder="Enter province"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white"
                  >Zip Code <span class="text-danger">*</span></label
                >
                <input
                  v-model="newCustomer.address.zipCode"
                  type="text"
                  required
                  maxlength="4"
                  pattern="[0-9]+"
                  placeholder="Enter zip code"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
            </div>
          </div>

          <!-- GCash Details -->
          <div class="space-y-4">
            <h4 class="font-medium text-black dark:text-white">GCash Details (Optional)</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Account Name</label>
                <input
                  v-model="newCustomer.gcashDetails.accountName"
                  type="text"
                  placeholder="Enter GCash account name"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Account Number</label>
                <input
                  v-model="newCustomer.gcashDetails.accountNumber"
                  type="text"
                  placeholder="Enter GCash account number"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
            </div>
          </div>

          <!-- Preferred Delivery Time -->
          <div>
            <label class="mb-2.5 block text-black dark:text-white">Preferred Delivery Time</label>
            <input
              v-model="newCustomer.preferredDeliveryTime"
              type="text"
              placeholder="e.g., Morning, Afternoon, Evening"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            />
          </div>

          <!-- Form Actions -->
          <div class="flex justify-end gap-4">
            <button
              type="button"
              @click="handleCloseModal"
              class="rounded border border-stroke px-6 py-2 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
            >
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Register' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>