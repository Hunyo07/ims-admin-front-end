<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Remove user-related interfaces and keep only branch-related ones
interface Address {
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
}

interface Branch {
  _id: string
  name: string
  email: string
  contactNumber: string
  address: Address
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Update refs
const branches = ref<Branch[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const showModal = ref(false)
const isDeleting = ref(false)
const selectedBranchId = ref(null)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isEditing = ref(false)
const editingBranch = ref(null)
const isSubmitting = ref(false)
const newBranch = ref({
  name: '',
  email: '',
  contactNumber: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  },
  isActive: true
})
// Update computed properties
const filteredBranches = computed(() => {
  return branches.value.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      branch.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesSearch
  })
})

const fetchBranches = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/branches/branches', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    branches.value = response.data.branches || response.data
  } catch (error) {
    console.error('Error fetching branches:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching branches'
    })
  } finally {
    isLoading.value = false
  }
}

const paginatedBranches = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredBranches.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredBranches.value.length / itemsPerPage.value))
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newBranch.value).some((key) => newBranch.value[key] !== '')
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
// Add handleEditBranch and handleDeleteBranch functions
const handleEditBranch = (branch) => {
  isEditing.value = true
  editingBranch.value = branch
  newBranch.value = { ...branch }
  showModal.value = true
}

const handleDeleteBranch = async (branchId) => {
  selectedBranchId.value = branchId
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      await axios.delete(`http://localhost:5000/api/branches/branches/${branchId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      socket.emit('deleteBranch', branchId)
      Swal.fire('Deleted!', 'Branch has been deleted.', 'success')
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting branch'
      })
    } finally {
      isDeleting.value = false
      selectedBranchId.value = null
    }
  }
}
const handleToggleStatus = async (branchId, currentStatus) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Branch?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this branch?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/branches/branches/${branchId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      branches.value = branches.value.map((branch) =>
        branch._id === branchId ? { ...branch, isActive: !currentStatus } : branch
      )

      socket.emit('updateBranch', response.data.branch)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Branch ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1500,
        showConfirmButton: false
      })
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error toggling branch status'
    })
  }
}
const handleAddBranch = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post(
      'http://localhost:5000/api/branches/create-branch',
      newBranch.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Remove this line since the branch will be added through the socket event
    // branches.value = [createdBranch, ...branches.value]

    socket.emit('createBranch', response.data.branch)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Branch created successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating branch'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateBranch = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.put(
      `http://localhost:5000/api/branches/update-branch/${editingBranch.value._id}`,
      newBranch.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const updatedBranch = response.data.branch
    branches.value = branches.value.map((branch) =>
      branch._id === updatedBranch._id ? updatedBranch : branch
    )

    socket.emit('updateBranch', updatedBranch)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Branch updated successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating branch'
    })
  } finally {
    isSubmitting.value = false
  }
}
const resetForm = () => {
  newBranch.value = {
    name: '',
    email: '',
    contactNumber: '',
    address: {
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: ''
    }
  }
  isEditing.value = false
}

onMounted(() => {
  fetchBranches()

  // Socket listeners for real-time updates
  socket.on('branchCreated', (newBranch) => {
    if (newBranch && newBranch._id) {
      // Remove the local addition of the branch since it will come through the socket
      const exists = branches.value.some((branch) => branch._id === newBranch._id)
      if (!exists) {
        branches.value = [newBranch, ...branches.value]
      }
    }
  })
  socket.on('branchUpdated', (updatedBranch) => {
    if (updatedBranch && updatedBranch._id) {
      branches.value = branches.value.map((branch) =>
        branch._id === updatedBranch._id ? updatedBranch : branch
      )
    }
  })

  socket.on('branchDeleted', (branchId) => {
    if (branchId) {
      branches.value = branches.value.filter((branch) => branch._id !== branchId)
    }
  })

  // Cleanup on component unmount
  return () => {
    socket.off('branchCreated')
    socket.off('branchUpdated')
    socket.off('branchDeleted')
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
        <h4 class="text-xl font-bold text-black dark:text-white">Branch List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search branches..."
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
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Create Branch
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
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Branch Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Email</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Contact Number</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Address</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="6" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedBranches.length === 0">
            <td colspan="6" class="text-center py-4">No branches found</td>
          </tr>
          <tr
            v-for="branch in paginatedBranches"
            :key="branch._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  {{ branch.name.charAt(0).toUpperCase() }}
                </div>
                <p class="text-black dark:text-white">{{ branch.name }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ branch.email }}</td>
            <td class="py-4.5 px-4">{{ branch.contactNumber }}</td>
            <td class="py-4.5 px-4">
              <div class="text-sm">
                <p>{{ branch.address.street }},</p>
                <p>{{ branch.address.barangay }},</p>
                <p>{{ branch.address.city }}, {{ branch.address.province }}</p>
                <p>{{ branch.address.zipCode }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <div
                  :class="`h-3 w-3 rounded-full ${
                    branch.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                  }`"
                ></div>
                <button
                  @click="handleToggleStatus(branch._id, branch.isActive)"
                  :class="`text-sm font-medium ${
                    branch.isActive
                      ? 'text-success hover:text-meta-5'
                      : 'text-danger hover:text-meta-8'
                  }`"
                >
                  {{ branch.isActive ? 'Active' : 'Inactive' }}
                </button>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button @click="handleEditBranch(branch)" class="hover:text-primary">
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
                  @click="handleDeleteBranch(branch._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedBranchId === branch._id"
                >
                  <svg
                    v-if="!(isDeleting && selectedBranchId === branch._id)"
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

    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div class="relative w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">{{ isEditing ? 'Update Branch' : 'Create Branch' }}</h3>
          <button
            @click="
              () => {
                handleCloseModal()
              }
            "
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

        <!--  s Navigation -->

        <form
          @submit.prevent="isEditing ? handleUpdateBranch() : handleAddBranch()"
          class="space-y-6"
        >
          <!-- Basic Information -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Branch Name <span class="text-danger">*</span></label
              >
              <input
                v-model="newBranch.name"
                type="text"
                required
                placeholder="Enter branch name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Email <span class="text-danger">*</span></label
              >
              <input
                v-model="newBranch.email"
                type="email"
                required
                placeholder="Enter email address"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <!-- Contact Information -->
          <div>
            <label class="mb-2.5 block text-black dark:text-white"
              >Contact Number <span class="text-danger">*</span></label
            >
            <input
              v-model="newBranch.contactNumber"
              type="tel"
              required
              placeholder="Enter contact number"
              pattern="[0-9]+"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            />
          </div>

          <!-- Address Information -->
          <div class="space-y-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Street Address <span class="text-danger">*</span></label
              >
              <input
                v-model="newBranch.address.street"
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
                v-model="newBranch.address.barangay"
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
                  v-model="newBranch.address.city"
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
                  v-model="newBranch.address.province"
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
                  v-model="newBranch.address.zipCode"
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

          <!-- Form Actions -->
          <div class="flex justify-end gap-4">
            <button
              type="button"
              @click="
                () => {
                  handleCloseModal()
                }
              "
              class="rounded border border-stroke px-6 py-2 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
            >
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
