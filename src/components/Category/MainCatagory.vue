<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Update interfaces
interface Category {
  _id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Update refs
const categories = ref<Category[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const selectedCategoryId = ref(null)
const editingCategory = ref(null)

const newCategory = ref({
  name: '',
  description: '',
  isActive: true
})

// Update fetch function
const fetchCategories = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/categories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    categories.value = response.data || []
  } catch (error) {
    categories.value = [] // Set empty array on error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching categories'
    })
  } finally {
    isLoading.value = false
  }
}

// Update computed properties
const filteredCategories = computed(() => {
  return categories.value.filter((category) => {
    const searchLower = searchQuery.value.toLowerCase()
    return (
      category.name.toLowerCase().includes(searchLower) ||
      category.description.toLowerCase().includes(searchLower)
    )
  })
})
const totalPages = computed(() => {
  return Math.ceil(filteredCategories.value.length / itemsPerPage.value)
})

const paginatedCategories = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCategories.value.slice(start, end)
})
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newCategory.value).some((key) => newCategory.value[key] !== '')
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
const resetForm = () => {
  newCategory.value = {
    name: '',
    description: '',
    isActive: true
  }
  isEditing.value = false
  editingCategory.value = null
}
// Update CRUD functions
const handleAddCategory = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post(
      'http://localhost:5000/api/categories/create',
      newCategory.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Don't add to local state here, let the socket handle it
    socket.emit('createCategory', response.data.category)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Category created successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating category'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleEditCategory = (category) => {
  isEditing.value = true
  editingCategory.value = category
  newCategory.value = {
    name: category.name,
    description: category.description,
    isActive: category.isActive
  }
  showModal.value = true
}

const handleUpdateCategory = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.put(
      `http://localhost:5000/api/categories/${editingCategory.value._id}`,
      newCategory.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )
    categories.value = categories.value.map((category) =>
      category._id === editingCategory.value._id ? response.data.category : category
    )
    socket.emit('updateCategory', response.data.category)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Category updated successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating category'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleDeleteCategory = async (categoryId) => {
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
      selectedCategoryId.value = categoryId
      await axios.delete(`http://localhost:5000/api/categories/${categoryId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Update local state immediately
      categories.value = categories.value.filter((category) => category._id !== categoryId)
      socket.emit('deleteCategory', categoryId)

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Category has been deleted.',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting category'
      })
    } finally {
      isDeleting.value = false
      selectedCategoryId.value = null
    }
  }
}

const handleToggleStatus = async (categoryId, currentStatus) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Category?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this category?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/categories/${categoryId}/toggle-status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      categories.value = categories.value.map((category) =>
        category._id === categoryId ? { ...category, isActive: !currentStatus } : category
      )

      socket.emit('updateCategory', response.data.category)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Category ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1000,
        showConfirmButton: false
      })
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error toggling category status'
    })
  }
}

// Update socket listeners
onMounted(() => {
  fetchCategories()
  socket.on('categoryCreated', (newCategory) => {
    if (newCategory && newCategory._id) {
      const exists = categories.value.some((category) => category._id === newCategory._id)
      if (!exists) {
        categories.value = [newCategory, ...categories.value]
      }
    }
  })

  socket.on('categoryUpdated', (updatedCategory) => {
    if (updatedCategory && updatedCategory._id) {
      categories.value = categories.value.map((category) =>
        category._id === updatedCategory._id ? updatedCategory : category
      )
    }
  })

  socket.on('categoryDeleted', (categoryId) => {
    if (categoryId) {
      categories.value = categories.value.filter((category) => category._id !== categoryId)
    }
  })

  return () => {
    socket.off('categoryCreated')
    socket.off('categoryUpdated')
    socket.off('categoryDeleted')
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
        <h4 class="text-xl font-bold text-black dark:text-white">Category List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search Categories..."
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
            Create Category
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
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Category Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Description</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="4" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedCategories.length === 0">
            <td colspan="4" class="text-center py-4">No categories found</td>
          </tr>
          <tr
            v-for="category in paginatedCategories"
            :key="category._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  {{ category.name.charAt(0).toUpperCase() }}
                </div>
                <p class="text-black dark:text-white">{{ category.name }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ category.description }}</td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <div
                  :class="`h-3 w-3 rounded-full ${
                    category.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                  }`"
                ></div>
                <button
                  @click="handleToggleStatus(category._id, category.isActive)"
                  :class="`text-sm font-medium ${
                    category.isActive
                      ? 'text-success hover:text-meta-5'
                      : 'text-danger hover:text-meta-8'
                  }`"
                >
                  {{ category.isActive ? 'Active' : 'Inactive' }}
                </button>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button @click="handleEditCategory(category)" class="hover:text-primary">
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
                  @click="handleDeleteCategory(category._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedCategoryId === category._id"
                >
                  <svg
                    v-if="!(isDeleting && selectedCategoryId === category._id)"
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
            {{ isEditing ? 'Update Category' : 'Create Category' }}
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

        <form
          @submit.prevent="isEditing ? handleUpdateCategory() : handleAddCategory()"
          class="space-y-6"
        >
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Category Name <span class="text-danger">*</span>
              </label>
              <input
                v-model="newCategory.name"
                type="text"
                required
                placeholder="Enter category name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Description <span class="text-danger">*</span>
              </label>
              <textarea
                v-model="newCategory.description"
                required
                placeholder="Enter category description"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              ></textarea>
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
              class="rounded border border-stroke px-6 py-2 text-black hover:border-meta-1 hover:text-meta-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
              :disabled="isSubmitting"
            >
              <svg
                v-if="isSubmitting"
                class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              {{ isEditing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form> 
      </div>
    </div>
  </div>
</template>
