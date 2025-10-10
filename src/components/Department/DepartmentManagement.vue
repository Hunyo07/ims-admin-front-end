<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from '../../utils/axios'
import Swal from 'sweetalert2'
import { socket } from '../../socket'

interface Department {
  _id: string
  name: string
  code?: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const departments = ref<Department[]>([])
const isLoading = ref(true)
const showModal = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const selectedDepartmentId = ref<string | null>(null)
const searchQuery = ref('')

const newDepartment = ref({
  name: '',
  code: '',
  description: '',
  isActive: true
})

const filteredDepartments = computed(() => {
  if (!searchQuery.value) return departments.value
  const q = searchQuery.value.toLowerCase()
  return departments.value.filter(
    (d) => d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q)
  )
})

const fetchDepartments = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('/departments')
    departments.value = response.data.departments || []
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Failed to fetch departments'
    })
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  newDepartment.value = { name: '', code: '', description: '', isActive: true }
  selectedDepartmentId.value = null
  isEditing.value = false
}

const openCreateModal = () => {
  resetForm()
  showModal.value = true
}

const openEditModal = (department: Department) => {
  isEditing.value = true
  selectedDepartmentId.value = department._id
  newDepartment.value = {
    name: department.name,
    code: department.code || '',
    description: department.description || '',
    isActive: department.isActive
  }
  showModal.value = true
}

const handleCreateDepartment = async () => {
  try {
    if (!newDepartment.value.name) {
      return Swal.fire({ icon: 'warning', title: 'Validation', text: 'Name is required' })
    }
    isSubmitting.value = true
    const response = await axios.post('/departments', newDepartment.value)
    departments.value.unshift(response.data.department)
    showModal.value = false
    resetForm()
    Swal.fire({ icon: 'success', title: 'Success', text: 'Department created successfully' })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Failed to create department'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateDepartment = async () => {
  try {
    if (!selectedDepartmentId.value) return
    if (!newDepartment.value.name) {
      return Swal.fire({ icon: 'warning', title: 'Validation', text: 'Name is required' })
    }
    isSubmitting.value = true
    const response = await axios.put(`/departments/${selectedDepartmentId.value}`, newDepartment.value)
    departments.value = departments.value.map((d) =>
      d._id === response.data.department._id ? response.data.department : d
    )
    showModal.value = false
    resetForm()
    Swal.fire({ icon: 'success', title: 'Success', text: 'Department updated successfully' })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error?.response?.data?.message || 'Failed to update department'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleToggleStatus = async (department: Department) => {
  try {
    const response = await axios.patch(`/departments/${department._id}/toggle-status`)
    departments.value = departments.value.map((d) => (d._id === department._id ? response.data.department : d))
    Swal.fire({ icon: 'success', title: 'Success', text: 'Status updated' })
  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to update status' })
  }
}

const handleDeleteDepartment = async (departmentId: string) => {
  try {
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: 'Delete Department',
      text: 'Are you sure you want to delete this department?',
      showCancelButton: true,
      confirmButtonText: 'Delete'
    })
    if (!confirmed.isConfirmed) return
    await axios.delete(`/departments/${departmentId}`)
    departments.value = departments.value.filter((d) => d._id !== departmentId)
    Swal.fire({ icon: 'success', title: 'Deleted', text: 'Department deleted' })
  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to delete department' })
  }
}

onMounted(() => {
  fetchDepartments()
  // Authenticate socket with current user if available
  try {
    const userRaw = localStorage.getItem('user')
    if (userRaw) {
      const user = JSON.parse(userRaw)
      if (user && user._id) {
        socket.emit('authenticate', user._id)
      }
    }
  } catch {}

  // Real-time listeners
  socket.on('departmentCreated', (payload: any) => {
    if (payload?.department) {
      departments.value.unshift(payload.department)
    } else if (payload?._id) {
      departments.value.unshift(payload)
    }
  })
  socket.on('departmentUpdated', (updated: any) => {
    const dep = updated?.department || updated
    departments.value = departments.value.map((d) => (d._id === dep._id ? dep : d))
  })
  socket.on('departmentStatusToggled', (updated: any) => {
    const dep = updated?.department || updated
    departments.value = departments.value.map((d) => (d._id === dep._id ? dep : d))
  })
  socket.on('departmentDeleted', (deleted: any) => {
    const id = deleted?.departmentId || deleted?._id || deleted?.id
    if (id) {
      departments.value = departments.value.filter((d) => d._id !== id)
    }
  })
})

onUnmounted(() => {
  socket.off('departmentCreated')
  socket.off('departmentUpdated')
  socket.off('departmentStatusToggled')
  socket.off('departmentDeleted')
})
</script>

<template>
  <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
    <div class="p-4 border-b border-stroke dark:border-strokedark flex items-center justify-between">
      <div class="flex items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search departments..."
          class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-strokedark"
        />
      </div>
      <button @click="openCreateModal" class="rounded-lg bg-primary text-white py-2 px-4">Add Department</button>
    </div>

    <div class="p-4">
      <div v-if="isLoading" class="text-center py-10 text-gray-500">Loading departments...</div>

      <div v-else>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-gray-100 dark:bg-meta-4">
                <th class="py-3 px-4 text-left">Name</th>
                <th class="py-3 px-4 text-left">Code</th>
                <th class="py-3 px-4 text-left">Status</th>
                <th class="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dept in filteredDepartments" :key="dept._id" class="border-b border-stroke dark:border-strokedark">
                <td class="py-3 px-4">{{ dept.name }}</td>
                <td class="py-3 px-4">{{ dept.code || '-' }}</td>
                <td class="py-3 px-4">
                  <span :class="dept.isActive ? 'text-green-600' : 'text-gray-500'">
                    {{ dept.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <div class="flex gap-2">
                    <button class="rounded border border-stroke py-1 px-3" @click="openEditModal(dept)">Edit</button>
                    <button class="rounded border border-stroke py-1 px-3" @click="handleToggleStatus(dept)">
                      {{ dept.isActive ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button class="rounded border border-meta-1 text-meta-1 py-1 px-3" @click="handleDeleteDepartment(dept._id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredDepartments.length">
                <td colspan="4" class="py-6 text-center text-gray-500">No departments found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-boxdark rounded-lg w-full max-w-lg p-6 shadow-lg">
        <h3 class="text-xl font-semibold mb-4">{{ isEditing ? 'Edit Department' : 'Create Department' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block mb-2">Name</label>
            <input v-model="newDepartment.name" type="text" class="w-full rounded border border-stroke py-2 px-3 outline-none focus:border-primary dark:border-strokedark" />
          </div>
          <div>
            <label class="block mb-2">Code</label>
            <input v-model="newDepartment.code" type="text" class="w-full rounded border border-stroke py-2 px-3 outline-none focus:border-primary dark:border-strokedark" />
          </div>
          <div>
            <label class="block mb-2">Description</label>
            <textarea v-model="newDepartment.description" rows="3" class="w-full rounded border border-stroke py-2 px-3 outline-none focus:border-primary dark:border-strokedark"></textarea>
          </div>
          <div class="flex items-center gap-2">
            <input id="dept-active" v-model="newDepartment.isActive" type="checkbox" />
            <label for="dept-active">Active</label>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button class="rounded border border-stroke py-2 px-4" @click="showModal = false">Cancel</button>
          <button
            class="rounded bg-primary text-white py-2 px-4"
            :disabled="isSubmitting"
            @click="isEditing ? handleUpdateDepartment() : handleCreateDepartment()"
          >
            {{ isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>