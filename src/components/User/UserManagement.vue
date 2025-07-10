<script setup lang="ts">
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'
import { ref, onMounted, computed, watch } from 'vue'

const authStore = useAuthStore()
const userInfoLoaded = ref(false)

interface Address {
  street: string
  city: string
  province: string
  zipCode: string
}

interface GovernmentIds {
  sss: string | null
  tin: string | null
  philHealth: string | null
  pagIbig: string | null
}

interface Role {
  _id: string
  name: string
  permissions: string[]
  description: string
  createdAt: string
}
  
interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  address: Address
  governmentIds: GovernmentIds
  role: Role
  isActive: boolean
  lastLogin: string
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

const selectedBranch = ref('all')
const branches = ref([])
const roles = ref([])
const activeTab = ref('personal')
const users = ref<User[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedRole = ref('all')
const showModal = ref(false)
const isDeleting = ref(false)
const selectedUserId = ref(null)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isEditing = ref(false)
const editingUser = ref(null)

const newUser = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phoneNumber: '',
  birthDate: '',
  age: null,
  gender: '',
  nationality: '',
  civilStatus: '',
  emergencyContact: {
    name: '',
    relationship: '',
    phone: ''
  },
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  },
  role: '',
  employmentDate: new Date().toISOString().split('T')[0], // Today's date

  employmentStatus: '',
  schedule: {
    startTime: '08:00',
    endTime: '17:00',
    workDays: []
  },
  governmentIds: {
    sss: '',
    tin: '',
    philHealth: '',
    pagIbig: ''
  }
  // branchId: ''
})
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredUsers.value.slice(start, end)
})
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newUser.value).some((key) => newUser.value[key] !== '')
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
const totalPages = computed(() => Math.ceil(filteredUsers.value.length / itemsPerPage.value))
const calculateAge = (birthDate: string) => {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}
const fetchRoles = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/roles', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    roles.value = response.data.roles || response.data
  } catch (error) {
    console.error('Error fetching roles:', error)
  }
}
const fetchUsers = async () => {
  try {

    
    const response = await axios.get('http://localhost:5000/api/superadmin/users', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    
    
    // Check if response.data has the users array in a nested property
    users.value = response.data.users || response.data.data || response.data
    
    
    
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    isLoading.value = false
  }
}
const fetchBranches = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/superadmin/branches', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    branches.value = response.data.branches || response.data
  } catch (error) {
    console.error('Error fetching branches:', error)
  }
}
const handleEditUser = (user) => {
  editingUser.value = { ...user }
  // Map the user data to newUser format
  newUser.value = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: '', // Leave password empty for security
    phoneNumber: user.phoneNumber || '',
    birthDate: formatDate(user.birthDate), // Format the date properly
    age: user.age || null,
    gender: user.gender || '',
    nationality: user.nationality || '',
    civilStatus: user.civilStatus || '',
    emergencyContact: {
      name: user.emergencyContact?.name || '',
      relationship: user.emergencyContact?.relationship || '',
      phone: user.emergencyContact?.phone || ''
    },
    address: {
      street: user.address?.street || '',
      barangay: user.address?.barangay || '',
      city: user.address?.city || '',
      province: user.address?.province || '',
      zipCode: user.address?.zipCode || ''
    },
    role: user.role?._id || '',
    employmentDate: formatDate(user.employmentDate),
    employmentStatus: user.employmentStatus || '',
    schedule: {
      startTime: user.schedule?.startTime || '08:00',
      endTime: user.schedule?.endTime || '17:00',
      workDays: user.schedule?.workDays || []
    },
    governmentIds: {
      sss: user.governmentIds?.sss || '',
      tin: user.governmentIds?.tin || '',
      philHealth: user.governmentIds?.philHealth || '',
      pagIbig: user.governmentIds?.pagIbig || ''
    }
    // branchId: user.branch?._id || ''
  }
  isEditing.value = true
  showModal.value = true
  activeTab.value = 'personal'
}
//filteredUsers computed property
const filteredUsers = computed(() => {
  return users.value.filter((user) => {
    if (!user.role || !user.role.name) return false

    // Exclude superadmin users
    if (user.role.name.toLowerCase() === 'superadmin') return false

    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchQuery.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole =
      selectedRole.value === 'all' ||
      user.role.name.toLowerCase() === selectedRole.value.toLowerCase()
    const matchesBranch =
      selectedBranch.value === 'all' || user.branch?._id === selectedBranch.value

    return matchesSearch && matchesRole && matchesBranch
  })
})

const handleUpdateUser = async () => {
  try {
    if (!validateForm()) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: formError.value
      })
      return
    }

    isSubmitting.value = true
    const response = await axios.put(
      `http://localhost:5000/api/superadmin/users/${editingUser.value._id}/profile`,
      newUser.value, // Use newUser instead of editingUser
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Update local data first
    const updatedUser = response.data.user || response.data
    users.value = users.value.map((user) => (user._id === updatedUser._id ? updatedUser : user))

    // Emit socket event after successful update
    socket.emit('updateUser', updatedUser)

    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'User updated successfully',
      timer: 1000,
      timerProgressBar: true
    })

    showModal.value = false
    isEditing.value = false
    editingUser.value = null
    resetForm()
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error updating user'
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage,
      customClass: {
        confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
      }
    })
  } finally {
    isSubmitting.value = false
  }
}
// Add these refs after other refs
const isSubmitting = ref(false)
const formError = ref('')
const formSuccess = ref('')
// Add validation function
const validateForm = () => {
  if (!newUser.value.role) {
    formError.value = 'Please select a role'
    return false
  }
  // if (!newUser.value.branchId) {
  //   formError.value = 'Please select a branch'
  //   return false
  // }
  if (newUser.value.schedule.workDays.length === 0) {
    formError.value = 'Please select at least one work day'
    return false
  }
  return true
}
const resetForm = () => {
  newUser.value = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    birthDate: '',
    age: null,
    gender: '',
    nationality: '',
    civilStatus: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    address: {
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: ''
    },
    role: '',
    employmentDate: new Date().toISOString().split('T')[0],
    employmentStatus: '',
    schedule: {
      startTime: '08:00',
      endTime: '17:00',
      workDays: []
    },
    governmentIds: {
      sss: '',
      tin: '',
      philHealth: '',
      pagIbig: ''
    }
    // branchId: ''
  }
  isEditing.value = false
  editingUser.value = null
  activeTab.value = 'personal'
}
// Update handleAddUser to include validation
const handleAddUser = async () => {
  try {
    if (!validateForm()) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: formError.value
      })
      return
    }

    isSubmitting.value = true
    const response = await axios.post(
      'http://localhost:5000/api/superadmin/create-user',
      newUser.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    const createdUser = response.data.user || response.data

    users.value = [...users.value, createdUser]

    // Emit socket event after successful creation
    socket.emit('createUser', response.data)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'User created successfully',
      timer: 1000,
      timerProgressBar: true
    })
    await fetchUsers()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating user'
    })
  } finally {
    isSubmitting.value = false
  }
}

// Update handleDeleteUser function
const handleDeleteUser = async (userId) => {
  selectedUserId.value = userId
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
      await axios.delete(`http://localhost:5000/api/superadmin/delete-user/${userId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      socket.emit('deleteUser', userId)
      Swal.fire('Deleted!', 'User has been deleted.', 'success')
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error deleting user'
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage,
        customClass: {
          confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
        }
      })
    } finally {
      isDeleting.value = false
      selectedUserId.value = null
    }
  }
}

const handleToggleStatus = async (userId, currentStatus) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} User?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`,
      customClass: {
        confirmButton: currentStatus 
          ? 'swal2-confirm bg-danger text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
          : 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
        cancelButton: 'swal2-cancel bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
      }
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/superadmin/toggle-user-status/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      // Update local users list immediately
      users.value = users.value.map((user) =>
        user._id === userId ? { ...user, isActive: !currentStatus } : user
      )

      // Emit socket event
      socket.emit('updateUser', response.data.user)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1500,
        showConfirmButton: false
      })
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error toggling user status'
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage,
      customClass: {
        confirmButton: 'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
      }
    })
  }
}
onMounted(async () => {
  
  
  if (!authStore.user || !authStore.user.id) {
    
    await authStore.fetchCurrentUser();
          await authStore.fetchCurrentUser();
    }
    
    userInfoLoaded.value = true;
  
  fetchUsers()
  fetchRoles()
  fetchBranches()

  // Socket listeners for real-time updates
  socket.on('userCreated', (newUserData) => {
    if (newUserData && newUserData._id) {
      const exists = users.value.some((user) => user._id === newUserData._id)
      if (!exists) {
        users.value = [newUserData, ...users.value]
      }
    }
  })

  socket.on('userUpdated', (updatedUser) => {
    if (updatedUser && updatedUser._id) {
      users.value = users.value.map((user) => (user._id === updatedUser._id ? updatedUser : user))
    }
  })

  socket.on('userDeleted', (userId) => {
    if (userId) {
      users.value = users.value.filter((user) => user._id !== userId)
    }
  })

  // Cleanup on component unmount
  return () => {
    socket.off('userCreated')
    socket.off('userUpdated')
    socket.off('userDeleted')
  }
})

watch(
  () => newUser.value.birthDate,
  (newDate) => {
    newUser.value.age = calculateAge(newDate)
  }
)

// Place these after all imports and before the export
const canAssignRole = computed(() => authStore.hasPermission('assign_roles') || authStore.hasPermission('manage_users'));
const canCreateUser = computed(() => authStore.hasPermission('manage_users'));
const filteredRoles = computed(() => {
  const userRole = authStore.getUserRole();
  if (userRole === 'superadmin') {
    // Exclude superadmin and customer from the dropdown
    return roles.value.filter(role => role.name !== 'superadmin' && role.name !== 'customer');
  } else if (userRole === 'admin') {
    return roles.value.filter(role => role.name === 'staff');
  }
  return [];
});

// Check if current user can edit a specific user
const canEditUser = (user: User) => {
  const currentUserRole = authStore.getUserRole();
  const currentUserId = authStore.user?.id; // Changed from _id to id
  const userCreatedById = user.createdBy?.user?._id;
  

  
  if (currentUserRole === 'superadmin') {
    return true;
  } else if (currentUserRole === 'admin') {
    // Admin can only edit users they created
    // Convert both to strings for comparison to handle ObjectId vs string issues
    const canEdit = String(userCreatedById) === String(currentUserId);
    return canEdit;
  }
  return false;
};

// Check if current user can delete a specific user
const canDeleteUser = (user: User) => {
  const currentUserRole = authStore.getUserRole();
  const currentUserId = authStore.user?.id; // Changed from _id to id
  const userCreatedById = user.createdBy?.user?._id;
  

  
  if (currentUserRole === 'superadmin') {
    return true;
  } else if (currentUserRole === 'admin') {
    // Admin can only delete users they created
    const canDelete = String(userCreatedById) === String(currentUserId);
    return canDelete;
  }
  return false;
};

// Check if current user can toggle status of a specific user
const canToggleUserStatus = (user: User) => {
  const currentUserRole = authStore.getUserRole();
  const currentUserId = authStore.user?.id; // Changed from _id to id
  const userCreatedById = user.createdBy?.user?._id;
  

  
  if (currentUserRole === 'superadmin') {
    return true;
  } else if (currentUserRole === 'admin') {
    // Admin can only toggle status of users they created
    const canToggle = String(userCreatedById) === String(currentUserId);
    return canToggle;
  }
  return false;
};



</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="p-4 md:p-6 xl:p-7.5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h4 class="text-xl font-bold text-black dark:text-white">User List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search users..."
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
          <select
            v-model="selectedRole"
            class="rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <button
            v-if="canCreateUser"
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Create User
          </button>
        
        </div>
      </div>
    </div>

    <!-- Loading state for user info -->
    <div v-if="!userInfoLoaded" class="text-center py-8">
      <span class="text-lg text-gray-500">Loading user info...</span>
    </div>
    <div v-else>
      <!-- Table -->
      <div class="max-w-full overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Name</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Email</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Role</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Created By</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-4">Loading...</td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="7" class="text-center py-4">No users found</td>
            </tr>
            <tr
              v-for="user in paginatedUsers"
              :key="user._id"
              class="border-b border-stroke dark:border-strokedark"
            >
              <td class="py-4.5 px-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                    {{ user.firstName.charAt(0).toUpperCase() }}
                  </div>
                  <p class="text-black dark:text-white">{{ user.firstName }} {{ user.lastName }}</p>
                </div>
              </td>
              <td class="py-4.5 px-4">{{ user.email }}</td>
              <td class="py-4.5 px-4">
                <span
                  :class="`inline-block rounded px-2.5 py-0.5 text-sm font-medium ${
                    user.role.name === 'superadmin'
                      ? 'bg-meta-3 text-white'
                      : user.role.name === 'admin'
                        ? 'bg-meta-5 text-white'
                        : 'bg-meta-8 text-white'
                  }`"
                >
                  {{ user.role.name }}
                </span>
              </td>
              <td class="py-4.5 px-4">
                <div class="flex items-center space-x-2">
                  <div
                    :class="`h-3 w-3 rounded-full ${
                      user.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                    }`"
                  ></div>
                  <button
                    v-if="canToggleUserStatus(user)"
                    @click="handleToggleStatus(user._id, user.isActive)"
                    :class="`text-sm font-medium ${
                      user.isActive
                        ? 'text-success hover:text-meta-5'
                        : 'text-danger hover:text-meta-8'
                    }`"
                  >
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </button>
                  <span v-else :class="`text-sm font-medium ${
                    user.isActive ? 'text-success' : 'text-danger'
                  }`">
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </td>
              <td class="py-4.5 px-4">
                <div class="flex items-center gap-2">
                  <span v-if="user.createdBy?.user" class="text-sm">
                    {{ user.createdBy.user.firstName }} {{ user.createdBy.user.lastName }}
                    <span v-if="user.createdBy.user._id === authStore.user?.id" 
                          class="ml-1 px-2 py-0.5 text-xs bg-primary text-white rounded">
                      You
                    </span>
                  </span>
                  <span v-else class="text-sm text-gray-500">System</span>
                </div>
              </td>
              <td class="py-4.5 px-4">
                <div class="flex items-center space-x-2">
                  <button 
                    v-if="canEditUser(user)"
                    @click="handleEditUser(user)" 
                    class="hover:text-primary"
                    title="Edit User"
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
                    v-if="canToggleUserStatus(user)"
                    @click="handleToggleStatus(user._id, user.isActive)"
                    :class="`hover:${user.isActive ? 'text-danger' : 'text-success'}`"
                    :title="user.isActive ? 'Deactivate User' : 'Activate User'"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </button>
                  <button
                    v-if="canDeleteUser(user)"
                    @click="handleDeleteUser(user._id)"
                    class="hover:text-danger"
                    :disabled="isDeleting && selectedUserId === user._id"
                    title="Delete User"
                  >
                    <svg
                      v-if="!(isDeleting && selectedUserId === user._id)"
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
                  <span v-if="!canEditUser(user) && !canDeleteUser(user) && !canToggleUserStatus(user)" 
                        class="text-sm text-gray-500">
                    No actions available
                  </span>
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
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div class="relative w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">{{ isEditing ? 'Update User' : 'Create User' }}</h3>
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

        <!-- Tabs Navigation -->
        <div class="mb-6 border-b border-stroke">
          <div class="flex flex-wrap -mb-px">
            <button
              @click="activeTab = 'personal'"
              :class="[
                'inline-block p-4 rounded-t-lg',
                activeTab === 'personal'
                  ? 'text-primary border-b-2 border-primary'
                  : 'hover:text-gray-600 hover:border-gray-300'
              ]"
            >
              Personal Information
            </button>
            <button
              @click="activeTab = 'employment'"
              :class="[
                'inline-block p-4 rounded-t-lg',
                activeTab === 'employment'
                  ? 'text-primary border-b-2 border-primary'
                  : 'hover:text-gray-600 hover:border-gray-300'
              ]"
            >
              Employment Details
            </button>
            <button
              @click="activeTab = 'contact'"
              :class="[
                'inline-block p-4 rounded-t-lg',
                activeTab === 'contact'
                  ? 'text-primary border-b-2 border-primary'
                  : 'hover:text-gray-600 hover:border-gray-300'
              ]"
            >
              Contact & Emergency
            </button>
            <button
              @click="activeTab = 'documents'"
              :class="[
                'inline-block p-4 rounded-t-lg',
                activeTab === 'documents'
                  ? 'text-primary border-b-2 border-primary'
                  : 'hover:text-gray-600 hover:border-gray-300'
              ]"
            >
              Documents & IDs
            </button>
          </div>
        </div>

        <form
          @submit.prevent="isEditing ? handleUpdateUser() : handleAddUser()"
          class="max-h-[calc(100vh-250px)] overflow-y-auto"
        >
          <!-- Personal Information Tab -->
          <div v-show="activeTab === 'personal'" class="space-y-6">
            <!-- Existing Personal Information fields -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">First Name</label>
                <input
                  v-model="newUser.firstName"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Last Name</label>
                <input
                  v-model="newUser.lastName"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Email</label>
                <input
                  v-model="newUser.email"
                  type="email"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Password</label>
                <input
                  v-model="newUser.password"
                  type="password"
                  :required="!isEditing"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
            </div>
            <!-- Address Information -->
            <div class="col-span-2">
              <div class="grid grid-cols-2 gap-4 mb-2.5">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Street</label>
                  <input
                    v-model="newUser.address.street"
                    type="text"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Barangay</label>
                  <input
                    v-model="newUser.address.barangay"
                    type="text"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">City</label>
                <input
                  v-model="newUser.address.city"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Province</label>
                <input
                  v-model="newUser.address.province"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Zip Code</label>
                <input
                  v-model="newUser.address.zipCode"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
            </div>
            <!-- Contact & Personal Details -->
            <div class="col-span-2 grid grid-cols-3 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Phone Number</label>
                <input
                  v-model="newUser.phoneNumber"
                  type="tel"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Birth Date</label>
                <input
                  v-model="newUser.birthDate"
                  type="date"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Age</label>
                <input
                  v-model="newUser.age"
                  type="number"
                  required
                  readonly
                  class="w-full rounded border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
            </div>
            <!-- Additional Personal Info -->
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Gender</label>
                <select
                  v-model="newUser.gender"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Nationality</label>
                <input
                  v-model="newUser.nationality"
                  type="text"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div>
                <label class="mb-2.5 block text-black dark:text-white">Civil Status</label>
                <select
                  v-model="newUser.civilStatus"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Employment Tab -->
          <div v-show="activeTab === 'employment'" class="space-y-6">
            <!-- Employment Information -->
            <div class="col-span-2">
              <h4 class="mb-4 text-lg font-semibold">Employment Information</h4>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Role</label>
                  <select
                    v-if="canAssignRole"
                    v-model="newUser.role"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  >
                    <option v-for="role in filteredRoles" :key="role._id" :value="role._id">
                      {{ role.name }}
                    </option>
                  </select>
                  <input v-else type="text" v-model="newUser.role" readonly class="w-full rounded border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input" :required="false" tabindex="-1" />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Employment Date</label>
                  <input
                    v-model="newUser.employmentDate"
                    type="date"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Employment Status</label>
                  <select
                    v-model="newUser.employmentStatus"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contractual">Contractual</option>
                  </select>
                </div>
              </div>
            </div>
            <!-- Schedule -->
            <div class="col-span-2">
              <h4 class="mb-4 text-lg font-semibold">Schedule</h4>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Start Time</label>
                  <input
                    v-model="newUser.schedule.startTime"
                    type="time"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">End Time</label>
                  <input
                    v-model="newUser.schedule.endTime"
                    type="time"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Work Days</label>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="monday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Monday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="tuesday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Tuesday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="wednesday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Wednesday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="thursday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Thursday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="friday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Friday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="saturday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Saturday</span>
                    </label>
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="newUser.schedule.workDays"
                        value="sunday"
                        class="form-checkbox rounded border-stroke text-primary"
                      />
                      <span>Sunday</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <!-- Branch Assignment -->
            <!-- <div>
              <label class="mb-2.5 block text-black dark:text-white">Branch</label>
              <select
                v-model="newUser.branchId"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="">Select Branch</option>
                <option v-for="branch in branches" :key="branch._id" :value="branch._id">
                  {{ branch.name }}
                </option>
              </select>
            </div> -->
          </div>

          <!-- Contact Tab -->
          <div v-show="activeTab === 'contact'" class="space-y-6">
            <!-- Emergency Contact -->
            <div class="col-span-2">
              <h4 class="mb-4 text-lg font-semibold">Emergency Contact</h4>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Name</label>
                  <input
                    v-model="newUser.emergencyContact.name"
                    type="text"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Relationship</label>
                  <input
                    v-model="newUser.emergencyContact.relationship"
                    type="text"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Phone Number</label>
                  <input
                    v-model="newUser.emergencyContact.phone"
                    type="tel"
                    required
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Documents Tab -->
          <div v-show="activeTab === 'documents'" class="space-y-6">
            <div class="col-span-2">
              <h4 class="mb-4 text-lg font-semibold">Government IDs</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">SSS</label>
                  <input
                    v-model="newUser.governmentIds.sss"
                    type="text"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">TIN</label>
                  <input
                    v-model="newUser.governmentIds.tin"
                    type="text"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">PhilHealth</label>
                  <input
                    v-model="newUser.governmentIds.philHealth"
                    type="text"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">Pag-IBIG</label>
                  <input
                    v-model="newUser.governmentIds.pagIbig"
                    type="text"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Form Actions - Always visible -->
          <div
            class="sticky bottom-0 mt-6 flex justify-end gap-4 border-t border-stroke bg-white pt-6 dark:bg-boxdark"
          >
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
              class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
            >
              {{ isEditing ? 'Update' : 'Submit' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
