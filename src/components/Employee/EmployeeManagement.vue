<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores'
import { socket } from '../../socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Employee interfaces
interface Employee {
  _id: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Form type for new/edit employee
interface EmployeeForm {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
}

// Update refs
const employees = ref<Employee[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const showModal = ref(false)
const isDeleting = ref(false)
const isTogglingStatus = ref(false)
const selectedEmployeeId = ref<string | null>(null)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isEditing = ref(false)
const editingEmployee = ref<Employee | null>(null)
const isSubmitting = ref(false)
const newEmployee = ref<EmployeeForm>({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: ''
})

// Update computed properties
const filteredEmployees = computed(() => {
  return employees.value.filter((employee) => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchQuery.value.toLowerCase()) ||
      (employee.email && employee.email.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (employee.phoneNumber && employee.phoneNumber.includes(searchQuery.value))
    return matchesSearch
  })
})

const fetchEmployees = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/employees', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    employees.value = response.data.employees || response.data
  } catch (error: any) {
    console.error('Error fetching employees:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching employees'
    })
  } finally {
    isLoading.value = false
  }
}

const paginatedEmployees = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredEmployees.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredEmployees.value.length / itemsPerPage.value))
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  const ne = newEmployee.value
  return (
    ne.firstName !== '' ||
    ne.lastName !== '' ||
    ne.email !== '' ||
    ne.phoneNumber !== ''
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

// Edit and delete functions
const handleEditEmployee = (employee: Employee) => {
  isEditing.value = true
  editingEmployee.value = employee
  newEmployee.value = {
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    email: employee.email || '',
    phoneNumber: employee.phoneNumber || ''
  }
  showModal.value = true
}

const handleToggleEmployeeStatus = async (employee: Employee) => {
  const action = employee.isActive ? 'deactivate' : 'activate'
  const result = await Swal.fire({
    title: `Are you sure?`,
    text: `Do you want to ${action} ${employee.firstName} ${employee.lastName}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: `Yes, ${action} employee!`,
    customClass: {
      confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
      cancelButton:
        'swal2-cancel bg-danger text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
    }
  })

  if (result.isConfirmed) {
    try {
      isTogglingStatus.value = true
      selectedEmployeeId.value = employee._id
      const response = await axios.patch(
        `http://localhost:5000/api/employees/${employee._id}/toggle-status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      // Update the employee in the local array with the response data
      const updatedEmployee = response.data.employee
      employees.value = employees.value.map((e) => (e._id === employee._id ? updatedEmployee : e))

      // Emit socket event for real-time update
      socket.emit('employeeStatusToggled', updatedEmployee)

      Swal.fire('Success!', `Employee has been ${action}d.`, 'success')
    } catch (error: any) {
      console.error('Error toggling employee status:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || `Error ${action}ing employee`
      })
    } finally {
      isTogglingStatus.value = false
      selectedEmployeeId.value = null
    }
  }
}

const handleDeleteEmployee = async (employeeId: string) => {
  selectedEmployeeId.value = employeeId
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
      cancelButton:
        'swal2-cancel bg-danger text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
    }
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      await axios.delete(`http://localhost:5000/api/employees/${employeeId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      socket.emit('deleteEmployee', employeeId)
      Swal.fire('Deleted!', 'Employee has been deleted.', 'success')
      employees.value = employees.value.filter((employee) => employee._id !== employeeId)
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting employee'
      })
    } finally {
      isDeleting.value = false
      selectedEmployeeId.value = null
    }
  }
}

const handleAddEmployee = async () => {
  try {
    isSubmitting.value = true
    const response = await axios.post(
      'http://localhost:5000/api/employees/register',
      newEmployee.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    socket.emit('createEmployee', response.data.employee)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Employee created successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating employee'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateEmployee = async () => {
  try {
    isSubmitting.value = true
    if (!editingEmployee.value) {
      throw new Error('No employee selected for editing.')
    }
    const response = await axios.put(
      `http://localhost:5000/api/employees/${editingEmployee.value._id}`,
      newEmployee.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const updatedEmployee = response.data.employee
    employees.value = employees.value.map((employee) =>
      employee._id === updatedEmployee._id ? updatedEmployee : employee
    )

    socket.emit('updateEmployee', updatedEmployee)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Employee updated successfully',
      timer: 1500
    })
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating employee'
    })
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  newEmployee.value = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  }
  isEditing.value = false
  editingEmployee.value = null
}

onMounted(() => {
  fetchEmployees()

  // Ensure socket is connected
  if (!socket.connected) {
    socket.connect()
  }

  // Socket listeners for real-time updates
  socket.on('employeeCreated', (newEmployee) => {
    if (newEmployee && newEmployee._id) {
      const exists = employees.value.some((employee) => employee._id === newEmployee._id)
      if (!exists) {
        employees.value = [newEmployee, ...employees.value]
      }
    }
  })

  socket.on('employeeUpdated', (updatedEmployee) => {
    if (updatedEmployee && updatedEmployee._id) {
      employees.value = employees.value.map((employee) =>
        employee._id === updatedEmployee._id ? updatedEmployee : employee
      )
    }
  })

  socket.on('employeeStatusToggled', (updatedEmployee) => {
    if (updatedEmployee && updatedEmployee._id) {
      employees.value = employees.value.map((employee) =>
        employee._id === updatedEmployee._id ? updatedEmployee : employee
      )
    }
  })

  socket.on('employeeDeleted', (employeeId) => {
    if (employeeId) {
      employees.value = employees.value.filter((employee) => employee._id !== employeeId)
    }
  })

  // Cleanup on component unmount
  return () => {
    socket.off('employeeCreated')
    socket.off('employeeUpdated')
    socket.off('employeeStatusToggled')
    socket.off('employeeDeleted')
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
        <h4 class="text-xl font-bold text-black dark:text-white">Employee List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search employees..."
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
            @click="fetchEmployees"
            class="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 mr-2"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Loading...' : 'Refresh' }}
          </button>
          <button
            v-if="authStore.canPerform('create_employee')"
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Add Employee
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
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Employee Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Email</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Phone Number</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th
              class="py-4.5 px-4 font-medium text-black dark:text-white"
              v-if="authStore.canPerform('edit_employee')"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="5" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedEmployees.length === 0">
            <td colspan="5" class="text-center py-4">No employees found</td>
          </tr>
          <tr
            v-for="employee in paginatedEmployees"
            :key="employee._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  {{ employee.firstName.charAt(0).toUpperCase()
                  }}{{ employee.lastName.charAt(0).toUpperCase() }}
                </div>
                <p class="text-black dark:text-white">
                  {{ employee.firstName }} {{ employee.lastName }}
                </p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ employee.email || '—' }}</td>
            <td class="py-4.5 px-4">{{ employee.phoneNumber || '—' }}</td>
            <td class="py-4.5 px-4">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  employee.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                ]"
              >
                {{ employee.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button
                  v-if="authStore.canPerform('edit_employee')"
                  @click="handleEditEmployee(employee)"
                  class="hover:text-primary"
                >
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
                  v-if="authStore.canPerform('deactivate_employee')"
                  @click="handleToggleEmployeeStatus(employee)"
                  class="hover:text-warning"
                  :disabled="isTogglingStatus && selectedEmployeeId === employee._id"
                  :title="employee.isActive ? 'Deactivate Employee' : 'Activate Employee'"
                >
                  <svg
                    v-if="!(isTogglingStatus && selectedEmployeeId === employee._id)"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      v-if="employee.isActive"
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
                  v-if="authStore.canPerform('delete_employee')"
                  @click="handleDeleteEmployee(employee._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedEmployeeId === employee._id"
                >
                  <svg
                    v-if="!(isDeleting && selectedEmployeeId === employee._id)"
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

    <!-- Employee Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div
        class="relative w-full max-w-2xl max-h-[80%] overflow-auto rounded-lg bg-white p-8 dark:bg-boxdark"
      >
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">
            {{ isEditing ? 'Update Employee' : 'Add Employee' }}
          </h3>
          <button @click="handleCloseModal" class="hover:text-danger">
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
          @submit.prevent="isEditing ? handleUpdateEmployee() : handleAddEmployee()"
          class="space-y-6"
        >
          <!-- Personal Information -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-2.5 block text-black dark:text-white"
                >First Name <span class="text-danger">*</span></label
              >
              <input
                v-model="newEmployee.firstName"
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
                v-model="newEmployee.lastName"
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
              <label class="mb-2.5 block text-black dark:text-white">Email (Optional)</label>
              <input
                v-model="newEmployee.email"
                type="email"
                placeholder="Enter email address"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label class="mb-2.5 block text-black dark:text-white">Phone Number (Optional)</label>
              <input
                v-model="newEmployee.phoneNumber"
                type="tel"
                placeholder="Enter phone number"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
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
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
