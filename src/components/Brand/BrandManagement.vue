<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores'
import { socket } from '../../socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Brand interface
interface Brand {
  _id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy?: {
    user: {
      _id: string
      firstName: string
      lastName: string
      email: string
    }
    role: string
  }
}

// Reactive refs
const brands = ref<Brand[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const selectedBrandId = ref(null)
const editingBrand = ref<Brand | null>(null)
const newBrand = ref({
  name: '',
  description: '',
  isActive: true
})

// Fetch brands
const fetchBrands = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/brands', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    brands.value = response.data || []
  } catch (error) {
    brands.value = []
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: (error as any)?.response?.data?.message || 'Error fetching brands'
    })
  } finally {
    isLoading.value = false
  }
}

// Computed properties
const filteredBrands = computed(() => {
  return brands.value.filter((brand) => {
    const searchLower = searchQuery.value.toLowerCase()
    return (
      brand.name.toLowerCase().includes(searchLower) ||
      brand.description.toLowerCase().includes(searchLower)
    )
  })
})

const totalPages = computed(() => {
  return Math.ceil(filteredBrands.value.length / itemsPerPage.value)
})

const paginatedBrands = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredBrands.value.slice(start, end)
})

const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newBrand.value).some(
    (key) => newBrand.value[key as keyof typeof newBrand.value] !== ''
  )
})

// Modal handlers
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

const resetForm = () => {
  newBrand.value = {
    name: '',
    description: '',
    isActive: true
  }
  isEditing.value = false
  editingBrand.value = null
}

// CRUD operations
const handleAddBrand = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post('http://localhost:5000/api/brands', newBrand.value, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    brands.value.unshift(response.data.brand)
    socket.emit('createBrand', response.data.brand)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Brand created successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Error creating brand'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleEditBrand = (brand: Brand) => {
  isEditing.value = true
  editingBrand.value = brand
  newBrand.value = {
    name: brand.name,
    description: brand.description,
    isActive: brand.isActive
  }
  showModal.value = true
}

const handleUpdateBrand = async () => {
  try {
    isSubmitting.value = true
    if (!editingBrand.value || !editingBrand.value._id) return

    const response = await axios.put(
      `http://localhost:5000/api/brands/${editingBrand.value._id}`,
      newBrand.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    brands.value = brands.value.map((brand) =>
      brand._id === editingBrand.value!._id ? response.data.brand : brand
    )

    socket.emit('updateBrand', response.data.brand)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Brand updated successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Error updating brand'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleDeleteBrand = async (brandId: string) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, delete it!',
    customClass: {
      confirmButton: 'swal2-confirm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
      cancelButton:
        'swal2-cancel bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
    }
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      await axios.delete(`http://localhost:5000/api/brands/${brandId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      brands.value = brands.value.filter((brand) => brand._id !== brandId)
      socket.emit('deleteBrand', brandId)

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Brand has been deleted.',
        timer: 1500
      })
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.response?.data?.message || 'Error deleting brand'
      })
    } finally {
      isDeleting.value = false
    }
  }
}

const handleToggleStatus = async (brand: Brand) => {
  try {
    const response = await axios.patch(
      `http://localhost:5000/api/brands/${brand._id}/toggle-status`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    brands.value = brands.value.map((b) => (b._id === brand._id ? response.data.brand : b))

    socket.emit('updateBrand', response.data.brand)

    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: `Brand ${response.data.brand.isActive ? 'activated' : 'deactivated'} successfully`,
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Error updating brand status'
    })
  }
}

// Pagination
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// Socket listeners
onMounted(() => {
  fetchBrands()

  socket.on('brandCreated', (brand: Brand) => {
    brands.value.unshift(brand)
  })

  socket.on('brandUpdated', (brand: Brand) => {
    brands.value = brands.value.map((b) => (b._id === brand._id ? brand : b))
  })

  socket.on('brandDeleted', (brandId: string) => {
    brands.value = brands.value.filter((b) => b._id !== brandId)
  })
})

// Watch for search changes
watch(searchQuery, () => {
  currentPage.value = 1
})
</script>

<template>
  <div>
    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <!-- Header -->
      <div class="flex flex-col gap-4 p-6.5">
        <div class="flex items-center justify-between">
          <h4 class="text-xl font-semibold text-black dark:text-white">Brand list</h4>
          <button
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-center font-medium text-white hover:bg-opacity-90"
          >
            <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
            Add Brand
          </button>
        </div>

        <!-- Search and Filters -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search brands..."
              class="w-full rounded border border-stroke bg-transparent py-3 pl-10 pr-4 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary sm:w-80"
            />
            <svg
              class="absolute left-3 top-3.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        ></div>
      </div>

      <!-- Brands Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                Brand Name
              </th>
              <th class="min-w-[200px] py-4 px-4 font-medium text-black dark:text-white">
                Description
              </th>
              <th class="min-w-[100px] py-4 px-4 font-medium text-black dark:text-white">Status</th>
              <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Created By
              </th>
              <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Created Date
              </th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="brand in paginatedBrands"
              :key="brand._id"
              class="border-b border-stroke dark:border-strokedark"
            >
              <td class="border-b border-stroke py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                <h5 class="font-medium text-black dark:text-white">
                  {{ brand.name }}
                </h5>
              </td>
              <td class="border-b border-stroke py-5 px-4 dark:border-strokedark">
                <p class="text-sm text-black dark:text-white">
                  {{ brand.description }}
                </p>
              </td>
              <td class="border-b border-stroke py-5 px-4 dark:border-strokedark">
                <span
                  :class="[
                    'inline-flex rounded-full py-1 px-3 text-sm font-medium',
                    brand.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  ]"
                >
                  {{ brand.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="border-b border-stroke py-5 px-4 dark:border-strokedark">
                <p class="text-sm text-black dark:text-white">
                  {{ brand.createdBy?.user?.firstName }} {{ brand.createdBy?.user?.lastName }}
                </p>
              </td>
              <td class="border-b border-stroke py-5 px-4 dark:border-strokedark">
                <p class="text-sm text-black dark:text-white">
                  {{ new Date(brand.createdAt).toLocaleDateString() }}
                </p>
              </td>
              <td class="border-b border-stroke py-5 px-4 dark:border-strokedark">
                <div class="flex items-center space-x-3.5">
                  <button
                    @click="handleEditBrand(brand)"
                    class="hover:text-primary"
                    title="Edit Brand"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    @click="handleToggleStatus(brand)"
                    :class="[
                      'hover:text-primary',
                      brand.isActive ? 'text-red-600' : 'text-green-600'
                    ]"
                    :title="brand.isActive ? 'Deactivate Brand' : 'Activate Brand'"
                  >
                    <svg
                      v-if="brand.isActive"
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
                      ></path>
                    </svg>
                    <svg
                      v-else
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    @click="handleDeleteBrand(brand._id)"
                    class="hover:text-red-600"
                    title="Delete Brand"
                    :disabled="isDeleting"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty State -->
        <div v-if="filteredBrands.length === 0" class="py-12 text-center">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            ></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No brands found</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Get started by creating a new brand.'
            }}
          </p>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between border-t border-stroke px-6.5 py-4 dark:border-strokedark"
      >
        <div class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
          {{ Math.min(currentPage * itemsPerPage, filteredBrands.length) }} of
          {{ filteredBrands.length }} results
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="rounded-md border border-stroke bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-gray-800"
          >
            Previous
          </button>
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="rounded-md border border-stroke bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Brand Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="handleCloseModal"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-boxdark">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-black dark:text-white">
            {{ isEditing ? 'Edit Brand' : 'Add New Brand' }}
          </h3>
          <button
            @click="handleCloseModal"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <form @submit.prevent="isEditing ? handleUpdateBrand() : handleAddBrand()">
          <div class="mb-4">
            <label class="mb-2 block text-sm font-medium text-black dark:text-white">
              Brand Name *
            </label>
            <input
              v-model="newBrand.name"
              type="text"
              required
              class="w-full rounded border border-stroke bg-transparent py-3 px-4 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
              placeholder="Enter brand name"
            />
          </div>

          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium text-black dark:text-white">
              Description *
            </label>
            <textarea
              v-model="newBrand.description"
              required
              rows="3"
              class="w-full rounded border border-stroke bg-transparent py-3 px-4 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
              placeholder="Enter brand description"
            ></textarea>
          </div>

          <div class="flex items-center justify-end space-x-3">
            <button
              type="button"
              @click="handleCloseModal"
              class="rounded-md border border-stroke bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update Brand' : 'Create Brand' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
