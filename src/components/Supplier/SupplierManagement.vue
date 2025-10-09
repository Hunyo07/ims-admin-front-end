<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores'
import { socket } from '../../socket'
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

// Update interfaces
interface Supplier {
  _id: string
  name: string
  contactPerson: string
  email: string
  phoneNumber: string
  address: Address
  isActive: boolean
  branch: any // This will be populated from the backend
  createdAt: string
  updatedAt: string
}

// Update refs
const suppliers = ref<Supplier[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const showModal = ref(false)
const isDeleting = ref(false)
const selectedSupplierId = ref<string | null>(null)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isEditing = ref(false)
const editingSupplier = ref<Supplier | null>(null)
const isSubmitting = ref(false)
const newSupplier = ref({
  name: '',
  contactPerson: '',
  email: '',
  phoneNumber: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  },
  branchId: '', // Add this for branch selection
  isActive: true
})

// Update computed properties
const filteredSuppliers = computed(() => {
  return suppliers.value.filter((supplier) => {
    const searchLower = searchQuery.value.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(searchLower) ||
      supplier.email.toLowerCase().includes(searchLower) ||
      supplier.contactPerson.toLowerCase().includes(searchLower)
    )
  })
})

// Update fetch function
const fetchSuppliers = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/suppliers/suppliers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    suppliers.value = response.data.suppliers || response.data
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching suppliers'
    })
  } finally {
    isLoading.value = false
  }
}

// Update pagination computed
const paginatedSuppliers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredSuppliers.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredSuppliers.value.length / itemsPerPage.value)
})
// Update CRUD functions
const handleEditSupplier = (supplier: Supplier) => {
  isEditing.value = true
  editingSupplier.value = supplier
  newSupplier.value = {
    ...supplier,
    branchId: supplier.branch?._id
  }
  showModal.value = true
}

const handleDeleteSupplier = async (supplierId: string) => {
  selectedSupplierId.value = supplierId
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
      await axios.delete(`http://localhost:5000/api/suppliers/${supplierId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Update local suppliers list immediately
      suppliers.value = suppliers.value.filter((supplier) => supplier._id !== supplierId)

      // Emit socket event
      socket.emit('deleteSupplier', supplierId)

      Swal.fire('Deleted!', 'Supplier has been deleted.', 'success')
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting supplier'
      })
    } finally {
      isDeleting.value = false
      selectedSupplierId.value = null
    }
  }
}
const handleToggleStatus = async (supplierId: string, currentStatus: boolean) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Supplier?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this supplier?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/suppliers/${supplierId}/toggle-status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      suppliers.value = suppliers.value.map((supplier) =>
        supplier._id === supplierId ? { ...supplier, isActive: !currentStatus } : supplier
      )

      socket.emit('updateSupplier', response.data.supplier)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Supplier ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1500,
        showConfirmButton: false
      })
    }
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error toggling supplier status'
    })
  }
}
const handleAddSupplier = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post(
      'http://localhost:5000/api/suppliers/create-supplier',
      newSupplier.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Don't add to local state here, let the socket handle it
    socket.emit('createSupplier', response.data.supplier)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Supplier created successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating supplier'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateSupplier = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.put(
      `http://localhost:5000/api/suppliers/${editingSupplier.value!._id}`,
      newSupplier.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Update local suppliers list immediately
    suppliers.value = suppliers.value.map((supplier) =>
      supplier._id === response.data.supplier._id ? response.data.supplier : supplier
    )

    // Emit socket event
    socket.emit('updateSupplier', response.data.supplier)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Supplier updated successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating supplier'
    })
  } finally {
    isSubmitting.value = false
  }
}

// Update reset form
const resetForm = () => {
  newSupplier.value = {
    name: '',
    contactPerson: '',
    email: '',
    phoneNumber: '',
    address: {
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: ''
    },
    branchId: '',
    isActive: true
  }
  isEditing.value = false
}
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return (Object.keys(newSupplier.value) as Array<keyof typeof newSupplier.value>).some(
    (key) => newSupplier.value[key] !== ''
  )
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
// Update socket listeners
onMounted(() => {
  fetchSuppliers()

  socket.on('supplierCreated', (newSupplier) => {
    if (newSupplier && newSupplier._id) {
      const exists = suppliers.value.some((supplier) => supplier._id === newSupplier._id)
      // Check if branch exists before accessing _id
      if (!exists && (!newSupplier.branch || newSupplier.branch._id === authStore.user.branch)) {
        suppliers.value = [newSupplier, ...suppliers.value]
      }
    }
  })

  socket.on('supplierUpdated', (updatedSupplier) => {
    if (updatedSupplier && updatedSupplier._id) {
      suppliers.value = suppliers.value.map((supplier) =>
        supplier._id === updatedSupplier._id ? updatedSupplier : supplier
      )
    }
  })

  socket.on('supplierDeleted', (supplierId) => {
    if (supplierId) {
      suppliers.value = suppliers.value.filter((supplier) => supplier._id !== supplierId)
    }
  })

  return () => {
    socket.off('supplierCreated')
    socket.off('supplierUpdated')
    socket.off('supplierDeleted')
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
        <h4 class="text-xl font-bold text-black dark:text-white">Supplier List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search suppliers..."
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
            Create Supplier
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
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Supplier Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Contact Person</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Email</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Phone Number</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Address</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="8" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedSuppliers.length === 0">
            <td colspan="8" class="text-center py-4">No suppliers found</td>
          </tr>
          <tr
            v-for="supplier in paginatedSuppliers"
            :key="supplier._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  {{ supplier.name.charAt(0).toUpperCase() }}
                </div>
                <p class="text-black dark:text-white">{{ supplier.name }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ supplier.contactPerson }}</td>
            <td class="py-4.5 px-4">{{ supplier.email }}</td>
            <td class="py-4.5 px-4">{{ supplier.phoneNumber }}</td>
            <td class="py-4.5 px-4">
              <div class="text-sm">
                <p>{{ supplier.address.street }},</p>
                <p>{{ supplier.address.barangay }},</p>
                <p>{{ supplier.address.city }}, {{ supplier.address.province }}</p>
                <p>{{ supplier.address.zipCode }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <div
                  :class="`h-3 w-3 rounded-full ${
                    supplier.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                  }`"
                ></div>
                <button
                  @click="handleToggleStatus(supplier._id, supplier.isActive)"
                  :class="`text-sm font-medium ${
                    supplier.isActive
                      ? 'text-success hover:text-meta-5'
                      : 'text-danger hover:text-meta-8'
                  }`"
                >
                  {{ supplier.isActive ? 'Active' : 'Inactive' }}
                </button>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button @click="handleEditSupplier(supplier)" class="hover:text-primary">
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
                  @click="handleDeleteSupplier(supplier._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedSupplierId === supplier._id"
                >
                  <svg
                    v-if="!(isDeleting && selectedSupplierId === supplier._id)"
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
          <h3 class="text-xl font-semibold">
            {{ isEditing ? 'Update Supplier' : 'Create Supplier' }}
          </h3>
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
          @submit.prevent="isEditing ? handleUpdateSupplier() : handleAddSupplier()"
          class="space-y-6"
        >
          <!-- Basic Information -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Supplier Name <span class="text-danger">*</span></label
              >
              <input
                v-model="newSupplier.name"
                type="text"
                required
                placeholder="Enter supplier name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Contact Person <span class="text-danger">*</span></label
              >
              <input
                v-model="newSupplier.contactPerson"
                type="text"
                required
                placeholder="Enter contact person name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >Email <span class="text-danger">*</span></label
              >
              <input
                v-model="newSupplier.email"
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
                v-model="newSupplier.phoneNumber"
                type="tel"
                required
                placeholder="Enter phone number"
                pattern="[0-9]+"
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
                v-model="newSupplier.address.street"
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
                v-model="newSupplier.address.barangay"
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
                  v-model="newSupplier.address.city"
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
                  v-model="newSupplier.address.province"
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
                  v-model="newSupplier.address.zipCode"
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
