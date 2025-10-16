<template>
  <div class="border border-stroke rounded-lg p-4 mb-4 dark:border-strokedark">
    <div class="flex justify-between items-center mb-3">
      <h4 class="font-medium text-black dark:text-white">{{ title }}</h4>
      <button
        v-if="!required"
        @click="$emit('remove')"
        type="button"
        class="text-danger hover:text-opacity-80"
      >
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Product Selection -->
      <div>
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">
          Product <span v-if="required" class="text-danger">*</span>
        </label>
        <select
          :value="modelValue.productId"
          @change="updateProduct($event.target.value)"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
        >
          <option value="">Select {{ title }}</option>
          <option v-for="product in filteredProducts" :key="product._id" :value="product._id">
            {{ product.name }} ({{ product.sku }})
          </option>
        </select>
      </div>

      <!-- Serial Number Selection -->
      <div v-if="selectedProduct?.hasSerialNumbers">
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">
          Serial Number <span class="text-danger">*</span>
        </label>
        <select
          :value="modelValue.serialNumber"
          @change="updateField('serialNumber', $event.target.value)"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
        >
          <option value="">Select Serial Number</option>
          <option v-for="serial in availableSerials" :key="serial" :value="serial">
            {{ serial }}
          </option>
        </select>
      </div>

      <!-- ACN Display -->
      <div v-if="selectedProduct?.hasAssetControlNumber && modelValue.serialNumber">
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">ACN</label>
        <input
          :value="getACNForSerial()"
          readonly
          class="w-full rounded border-[1.5px] border-stroke bg-gray-100 px-3 py-2 outline-none dark:border-strokedark dark:bg-form-input"
        />
      </div>

      <!-- Property Number -->
      <div>
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">
          Property Number
        </label>
        <input
          :value="modelValue.propertyNumber"
          @input="updateField('propertyNumber', $event.target.value)"
          placeholder="CMP-001-25-0001"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
        />
      </div>

      <!-- Remarks -->
      <div class="md:col-span-2">
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">Remarks</label>
        <textarea
          :value="modelValue.remarks"
          @input="updateField('remarks', $event.target.value)"
          placeholder="Optional remarks for this item"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
          rows="2"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      productId: '',
      serialNumber: '',
      acn: '',
      propertyNumber: '',
      remarks: ''
    })
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  products: {
    type: Array,
    default: () => []
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'remove'])

const filteredProducts = computed(() => {
  return props.products.filter(product => {
    const categoryName = product.category?.name?.toLowerCase() || ''
    switch (props.type) {
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
        return true
    }
  })
})

const selectedProduct = computed(() => {
  return props.products.find(p => p._id === props.modelValue.productId)
})

const availableSerials = computed(() => {
  return selectedProduct.value?.serialNumbers || []
})

const updateProduct = (productId) => {
  const product = props.products.find(p => p._id === productId)
  const updated = {
    ...props.modelValue,
    productId,
    serialNumber: '',
    acn: ''
  }
  
  // Auto-fill specifications for desktop
  if (props.type === 'desktop' && product?.specifications) {
    const specs = product.specifications.reduce((acc, spec) => {
      acc[spec.name.toLowerCase()] = spec.value
      return acc
    }, {})
    
    updated.specifications = {
      processor: specs.processor || '',
      storage: specs.storage || '',
      ram: specs.ram || '',
      videoCard: specs['video card'] || specs.videocard || '',
      brand: product.brand?.name || ''
    }
  }
  
  emit('update:modelValue', updated)
}

const updateField = (field, value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value
  })
}

const getACNForSerial = () => {
  if (!selectedProduct.value?.hasAssetControlNumber || !props.modelValue.serialNumber) {
    return ''
  }
  
  const serialIndex = selectedProduct.value.serialNumbers?.indexOf(props.modelValue.serialNumber)
  if (serialIndex >= 0 && selectedProduct.value.assetControlNumbers?.[serialIndex]) {
    return selectedProduct.value.assetControlNumbers[serialIndex]
  }
  
  return 'ACN will be assigned'
}

// Watch for serial number changes to update ACN
watch(() => props.modelValue.serialNumber, (newSerial) => {
  if (newSerial && selectedProduct.value?.hasAssetControlNumber) {
    const acn = getACNForSerial()
    updateField('acn', acn)
  }
})
</script>