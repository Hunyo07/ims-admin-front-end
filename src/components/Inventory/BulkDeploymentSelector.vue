<template>
  <div class="space-y-4">
    <!-- Employee Selection -->
    <div class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <h4 class="font-medium mb-3">Select Employees for Deployment</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="employee in employees" :key="employee._id" class="flex items-center space-x-2">
          <input
            type="checkbox"
            :id="employee._id"
            :value="employee._id"
            v-model="selectedEmployees"
            class="rounded border-stroke"
          />
          <label :for="employee._id" class="text-sm cursor-pointer">
            {{ employee.firstName }} {{ employee.lastName }}
          </label>
        </div>
      </div>
    </div>

    <!-- Bulk Item Assignment -->
    <div v-if="selectedEmployees.length > 0" class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <h4 class="font-medium mb-3">Assign Items to Selected Employees</h4>
      
      <!-- Item Type Tabs -->
      <div class="flex space-x-2 mb-4">
        <button
          v-for="type in itemTypes"
          :key="type.key"
          @click="activeTab = type.key"
          :class="[
            'px-3 py-1 rounded text-sm',
            activeTab === type.key 
              ? 'bg-primary text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          {{ type.label }}
        </button>
      </div>

      <!-- Item Assignment for Active Tab -->
      <div class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Product</label>
            <select
              v-model="bulkAssignment[activeTab].productId"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            >
              <option value="">Select {{ itemTypes.find(t => t.key === activeTab)?.label }}</option>
              <option v-for="product in getFilteredProducts(activeTab)" :key="product._id" :value="product._id">
                {{ product.name }} (Stock: {{ product.currentStock }})
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Property Number Prefix</label>
            <input
              v-model="bulkAssignment[activeTab].propertyPrefix"
              placeholder="CMP-001-25-"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Remarks</label>
            <input
              v-model="bulkAssignment[activeTab].remarks"
              placeholder="Optional remarks"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <input
            type="checkbox"
            :id="`assign-${activeTab}`"
            v-model="bulkAssignment[activeTab].assignToAll"
          />
          <label :for="`assign-${activeTab}`" class="text-sm">
            Assign this {{ itemTypes.find(t => t.key === activeTab)?.label.toLowerCase() }} to all selected employees
          </label>
        </div>
      </div>
    </div>

    <!-- Deployment Preview -->
    <div v-if="selectedEmployees.length > 0" class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <h4 class="font-medium mb-3">Deployment Preview ({{ selectedEmployees.length }} employees)</h4>
      <div class="max-h-60 overflow-y-auto space-y-2">
        <div
          v-for="employeeId in selectedEmployees"
          :key="employeeId"
          class="flex items-center justify-between p-2 bg-gray-50 rounded dark:bg-meta-4"
        >
          <span class="font-medium">{{ getEmployeeName(employeeId) }}</span>
          <div class="flex space-x-1">
            <span
              v-for="(assignment, type) in bulkAssignment"
              :key="type"
              v-if="assignment.assignToAll && assignment.productId"
              class="px-2 py-1 bg-primary text-white text-xs rounded"
            >
              {{ type }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  employees: {
    type: Array,
    default: () => []
  },
  products: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:deploymentData'])

const selectedEmployees = ref([])
const activeTab = ref('desktop')

const itemTypes = [
  { key: 'desktop', label: 'Desktop' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'printer', label: 'Printer' },
  { key: 'scanner', label: 'Scanner' },
  { key: 'laptop', label: 'Laptop' }
]

const bulkAssignment = ref({
  desktop: { productId: '', propertyPrefix: 'CMP-', assignToAll: true, remarks: '' },
  monitor: { productId: '', propertyPrefix: 'MON-', assignToAll: true, remarks: '' },
  printer: { productId: '', propertyPrefix: 'PRT-', assignToAll: false, remarks: '' },
  scanner: { productId: '', propertyPrefix: 'SCN-', assignToAll: false, remarks: '' },
  laptop: { productId: '', propertyPrefix: 'LAP-', assignToAll: false, remarks: '' }
})

const getFilteredProducts = (type) => {
  return props.products.filter(product => {
    const categoryName = product.category?.name?.toLowerCase() || ''
    switch (type) {
      case 'desktop':
        return categoryName.includes('desktop') || categoryName.includes('computer')
      case 'monitor':
        return categoryName.includes('monitor')
      case 'printer':
        return categoryName.includes('printer')
      case 'scanner':
        return categoryName.includes('scanner')
      case 'laptop':
        return categoryName.includes('laptop')
      default:
        return false
    }
  })
}

const getEmployeeName = (employeeId) => {
  const employee = props.employees.find(e => e._id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'
}

// Generate deployment data
const generateDeploymentData = () => {
  const employees = selectedEmployees.value.map((employeeId, index) => {
    const employee = props.employees.find(e => e._id === employeeId)
    const items = []
    
    Object.entries(bulkAssignment.value).forEach(([type, assignment]) => {
      if (assignment.assignToAll && assignment.productId) {
        items.push({
          type,
          product: assignment.productId,
          propertyNumber: assignment.propertyPrefix ? `${assignment.propertyPrefix}${String(index + 1).padStart(3, '0')}` : '',
          remarks: assignment.remarks
        })
      }
    })
    
    return {
      id: employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      department: employee.department || '',
      items
    }
  })
  
  return { employees }
}

// Watch for changes and emit
const updateDeploymentData = () => {
  emit('update:deploymentData', generateDeploymentData())
}

// Watch for changes
watch([selectedEmployees, bulkAssignment], updateDeploymentData, { deep: true })

// Auto-select first matching products for desktop and monitor when products load
watch(
  () => props.products,
  (newProducts) => {
    const desktopList = getFilteredProducts('desktop')
    const monitorList = getFilteredProducts('monitor')
    if (!bulkAssignment.value.desktop.productId && desktopList.length) {
      bulkAssignment.value.desktop.productId = desktopList[0]._id
    }
    if (!bulkAssignment.value.monitor.productId && monitorList.length) {
      bulkAssignment.value.monitor.productId = monitorList[0]._id
    }
  },
  { immediate: true, deep: true }
)
</script>