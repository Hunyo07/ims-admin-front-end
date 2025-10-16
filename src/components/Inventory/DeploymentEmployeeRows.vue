<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-semibold">Deployment Employees</h3>
      <button
        type="button"
        @click="addEmployee"
        class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 flex items-center"
      >
        <svg class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Add Employee
      </button>
    </div>

    <div class="bg-gray-50 dark:bg-meta-4 p-4 rounded-sm">
      <div
        v-for="(employee, index) in deploymentEmployees"
        :key="index"
        class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end border-b border-stroke pb-4 last:border-0 last:pb-0"
      >
        <!-- Employee Selection -->
        <div class="md:col-span-3">
          <label class="mb-2.5 block text-black dark:text-white">
            Employee <span class="text-meta-1">*</span>
          </label>
          <select
            v-model="employee.employeeId"
            required
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          >
            <option value="">Select Employee</option>
            <option v-for="emp in employees" :key="emp._id" :value="emp._id">
              {{ emp.firstName }} {{ emp.lastName }}
            </option>
          </select>
        </div>

        <!-- Product Selection -->
        <div class="md:col-span-3">
          <label class="mb-2.5 block text-black dark:text-white">
            Product <span class="text-meta-1">*</span>
          </label>
          <select
            v-model="employee.productId"
            required
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          >
            <option value="">Select Product</option>
            <option v-for="product in products" :key="product._id" :value="product._id">
              {{ product.name }} ({{ product.sku }})
            </option>
          </select>
        </div>

        <!-- Property Number -->
        <div class="md:col-span-2">
          <label class="mb-2.5 block text-black dark:text-white">Property Number</label>
          <input
            v-model="employee.propertyNumber"
            type="text"
            placeholder="CMP-001-25-001"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          />
        </div>

        <!-- Quantity -->
        <div class="md:col-span-2">
          <label class="mb-2.5 block text-black dark:text-white">Quantity</label>
          <input
            v-model.number="employee.quantity"
            type="number"
            min="1"
            value="1"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          />
        </div>

        <!-- Remarks -->
        <div class="md:col-span-1">
          <label class="mb-2.5 block text-black dark:text-white">Remarks</label>
          <input
            v-model="employee.remarks"
            type="text"
            placeholder="Optional"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          />
        </div>

        <!-- Remove Button -->
        <div class="md:col-span-1">
          <button
            type="button"
            @click="removeEmployee(index)"
            class="bg-danger text-white p-2 rounded hover:bg-opacity-90 w-full h-12 flex items-center justify-center"
            :disabled="deploymentEmployees.length <= 1"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

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

const deploymentEmployees = ref([
  {
    employeeId: '',
    productId: '',
    propertyNumber: '',
    quantity: 1,
    remarks: ''
  }
])

const addEmployee = () => {
  deploymentEmployees.value.push({
    employeeId: '',
    productId: '',
    propertyNumber: '',
    quantity: 1,
    remarks: ''
  })
}

const removeEmployee = (index) => {
  if (deploymentEmployees.value.length > 1) {
    deploymentEmployees.value.splice(index, 1)
  }
}

const generateDeploymentData = () => {
  const employees = deploymentEmployees.value
    .filter(emp => emp.employeeId && emp.productId)
    .map(emp => {
      const employee = props.employees.find(e => e._id === emp.employeeId)
      return {
        id: emp.employeeId,
        name: employee ? `${employee.firstName} ${employee.lastName}` : '',
        department: employee?.department || '',
        items: [{
          type: 'general',
          product: emp.productId,
          propertyNumber: emp.propertyNumber,
          quantity: emp.quantity,
          remarks: emp.remarks
        }]
      }
    })
  
  return { employees }
}

watch(deploymentEmployees, () => {
  emit('update:deploymentData', generateDeploymentData())
}, { deep: true })
</script>