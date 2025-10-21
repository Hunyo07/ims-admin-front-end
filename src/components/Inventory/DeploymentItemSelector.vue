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
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
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

      <!-- Quantity and Serial Inputs for Serialized Items -->
      <div v-if="selectedProduct?.hasSerialNumbers" class="md:col-span-2">
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">
          Quantity to generate <span class="text-danger">*</span>
        </label>
        <input
          :value="modelValue.quantity"
          @input="updateQuantity($event.target.value)"
          type="number"
          min="1"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
        />
        <p class="mt-1 text-xs text-bodydark2">
          Unassigned serial suggestions: {{ availableSerials.length }}
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
          <div v-for="(sn, idx) in modelValue.serials" :key="idx">
            <label class="mb-1 block text-xs font-medium text-black dark:text-white">
              Serial Number #{{ idx + 1 }} <span class="text-danger">*</span>
            </label>
            <input
              :value="sn"
              @input="updateSerialAt(idx, $event.target.value)"
              :list="'serial-suggestions-' + idx"
              placeholder="Enter serial manually or pick a suggestion"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
            />
            <datalist :id="'serial-suggestions-' + idx">
              <option
                v-for="serial in getAvailableSerialsForIndex(idx)"
                :key="serial"
                :value="serial"
              >
                {{ serial }}
              </option>
            </datalist>
            <p class="mt-1 text-xs text-bodydark2">
              {{
                sn
                  ? availableSerials.includes(sn)
                    ? 'Suggestion: unassigned serial'
                    : 'Manual serial accepted (will be added)'
                  : ''
              }}
            </p>
          </div>
        </div>
      </div>

      <!-- Quantity for ACN-only items (non-serialized) -->
      <div v-if="selectedProduct && !selectedProduct.hasSerialNumbers" class="md:col-span-2">
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">
          Quantity to generate <span class="text-danger">*</span>
        </label>
        <input
          :value="modelValue.quantity"
          @input="updateQuantity($event.target.value)"
          type="number"
          min="1"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input"
        />
        <p class="mt-1 text-xs text-bodydark2">
          This item does not require serial numbers. One ACN per quantity.
        </p>
      </div>

      <!-- ACN Display (non-serialized) -->
      <div
        v-if="
          selectedProduct &&
          !selectedProduct.hasSerialNumbers &&
          selectedProduct.hasAssetControlNumber
        "
      >
        <label class="mb-2 block text-sm font-medium text-black dark:text-white">ACN</label>
        <input
          :value="props.modelValue.acn"
          readonly
          class="w-full rounded border-[1.5px] border-stroke bg-gray-100 px-3 py-2 outline-none dark:border-strokedark dark:bg-form-input"
        />
      </div>

      <!-- Property Number -->
      <div class="flex">
        <div class="flex justify-center items-center gap-2">
          <button
            type="button"
            @click="generateACN"
            :disabled="
              !selectedProduct ||
              acnLoading ||
              (selectedProduct?.hasSerialNumbers && !canGenerateSerialized)
            "
            class="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-opacity-90 disabled:opacity-50"
          >
            {{ acnLoading ? 'Generating…' : 'Generate ACN' }}
          </button>
          <button
            type="button"
            @click="generateAndPrint"
            :disabled="
              !selectedProduct ||
              acnLoading ||
              (selectedProduct?.hasSerialNumbers && !canGenerateSerialized)
            "
            class="rounded-md bg-primary text-white px-3 py-2 text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
          >
            {{ acnLoading ? 'Generating…' : 'Generate & Print' }}
          </button>
        </div>
        <p
          v-if="selectedProduct && selectedProduct.hasSerialNumbers"
          class="mt-1 text-xs text-bodydark2"
        >
          Set quantity and pick serials without ACN; duplicates are prevented.
        </p>
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
import { computed, watch, ref } from 'vue'
import axios from '../../utils/axios'
import Swal from 'sweetalert2'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      productId: '',
      serialNumber: '',
      quantity: 1,
      serials: [],
      acn: '',
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

const emit = defineEmits(['update:modelValue', 'remove', 'generationComplete'])

const filteredProducts = computed(() => {
  return props.products.filter((product) => {
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
  return props.products.find((p) => p._id === props.modelValue.productId)
})

const availableSerials = computed(() => {
  const serials = selectedProduct.value?.serialNumbers || []
  const acns = selectedProduct.value?.assetControlNumbers || []
  // If ACN tracking is enabled and we have ACN data, only show serials without ACN
  if (selectedProduct.value?.hasAssetControlNumber && Array.isArray(acns) && acns.length) {
    return serials.filter((sn, idx) => !acns[idx])
  }
  return serials
})

const updateQuantity = (val) => {
  let q = parseInt(val)
  if (Number.isNaN(q)) q = 1
  if (selectedProduct.value?.hasSerialNumbers) {
    // For serialized items, allow any positive quantity; manual serial entry is permitted
    if (q < 1) q = 1
    let arr = Array.isArray(props.modelValue.serials) ? [...props.modelValue.serials] : []
    if (arr.length > q) {
      arr.splice(q)
    } else {
      while (arr.length < q) arr.push('')
    }
    emit('update:modelValue', { ...props.modelValue, quantity: q, serials: arr })
  } else {
    // ACN-only items: quantity is any positive integer; no serials needed
    if (q < 1) q = 1
    emit('update:modelValue', { ...props.modelValue, quantity: q, serials: [] })
  }
}

const updateSerialAt = (idx, value) => {
  const arr = Array.isArray(props.modelValue.serials) ? [...props.modelValue.serials] : []
  arr[idx] = String(value || '').trim()
  emit('update:modelValue', { ...props.modelValue, serials: arr })
}

const getAvailableSerialsForIndex = (idx) => {
  const current = Array.isArray(props.modelValue.serials) ? props.modelValue.serials : []
  const chosen = current.filter((s) => !!s && current.indexOf(s) !== idx)
  return availableSerials.value.filter((sn) => !chosen.includes(sn) || sn === current[idx])
}

const canGenerateSerialized = computed(() => {
  if (!selectedProduct.value?.hasSerialNumbers) return true
  const qty = parseInt(props.modelValue.quantity) || 0
  const arrRaw = Array.isArray(props.modelValue.serials) ? props.modelValue.serials : []
  const arr = arrRaw.map((s) => String(s || '').trim())
  if (qty < 1) return false
  if (arr.length !== qty) return false
  // require all serials to be non-empty
  if (arr.some((s) => !s)) return false
  // prevent duplicates
  if (new Set(arr).size !== arr.length) return false
  // Manual serial entry is allowed; backend will validate and map
  return true
})

const updateProduct = (productId) => {
  const product = props.products.find((p) => p._id === productId)
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
// Reset quantity and serials when product changes
watch(
  () => props.modelValue.productId,
  () => {
    if (selectedProduct.value?.hasSerialNumbers) {
      // Default to 1 input for serialized items regardless of suggestions
      const qty = 1
      const serials = Array(qty).fill('')
      emit('update:modelValue', { ...props.modelValue, quantity: qty, serials })
    } else {
      emit('update:modelValue', { ...props.modelValue, quantity: 1, serials: [] })
    }
  }
)

// Generate ACN for selected product (and optional serial)
const acnLoading = ref(false)
const generateACN = async () => {
  if (!selectedProduct.value) return
  try {
    acnLoading.value = true
    if (selectedProduct.value.hasSerialNumbers) {
      const serials = Array.isArray(props.modelValue.serials)
        ? props.modelValue.serials.filter(Boolean)
        : []
      const successes = []
      const failures = []
      for (const sn of serials) {
        try {
          const { data } = await axios.post('/acns/generate', {
            productId: selectedProduct.value._id,
            serialNumber: sn
          })
          console.log(data.value)
          if (data?.success && data?.acn) {
            successes.push(data.acn)
          } else {
            failures.push(sn)
          }
        } catch (e) {
          failures.push(sn)
        }
      }
      if (successes.length) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Generated ${successes.length} ACN(s)`,
          text: successes.join(', '),
          showConfirmButton: false,
          timer: 2500
        })
      }
      if (failures.length) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: `Failed for ${failures.length} serial(s)`,
          text: failures.join(', '),
          showConfirmButton: false,
          timer: 3000
        })
      }
      emit('generationComplete', successes.length)
    } else {
      const qty = parseInt(props.modelValue.quantity) || 1
      const successes = []
      const failures = []
      for (let i = 0; i < qty; i++) {
        try {
          const { data } = await axios.post('/acns/generate', {
            productId: selectedProduct.value._id
          })
          if (data?.success && data?.acn) {
            successes.push(data.acn)
          } else {
            failures.push(`#${i + 1}`)
          }
        } catch (e) {
          failures.push(`#${i + 1}`)
        }
      }
      if (successes.length) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Generated ${successes.length} ACN(s)`,
          text: successes.join(', '),
          showConfirmButton: false,
          timer: 2500
        })
      }
      if (failures.length) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: `Failed for ${failures.length} item(s)`,
          text: failures.join(', '),
          showConfirmButton: false,
          timer: 3000
        })
      }
      emit('generationComplete', successes.length)
    }
  } catch (err) {
    console.error('Failed to generate ACN:', err)
    const msg = err?.response?.data?.message || 'Failed to generate ACN'
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error',
      text: msg,
      showConfirmButton: false,
      timer: 2500
    })
  } finally {
    acnLoading.value = false
  }
}

// Generate ACN and immediately open print dialog for ACN barcode
const generateAndPrint = async () => {
  if (!selectedProduct.value) return
  try {
    acnLoading.value = true
    if (selectedProduct.value.hasSerialNumbers) {
      const serials = Array.isArray(props.modelValue.serials)
        ? props.modelValue.serials.filter(Boolean)
        : []
      let printed = 0
      for (const sn of serials) {
        try {
          const { data } = await axios.post('/acns/generate', {
            productId: selectedProduct.value._id,
            serialNumber: sn
          })
          if (data?.success && data?.acn && data?.acnRecordId) {
            const res = await axios.get(`/barcodes/acn/${data.acnRecordId}`)
            const printData = res?.data?.printData
            if (printData?.barcodeImage) {
              const html =
                `<!doctype html><html><head><title>Print ACN ${
                  printData.acnInfo?.acnCode || ''
                }</title></head><body style="margin:0;padding:20px;font-family:Arial,sans-serif;">` +
                `<div style="text-align:center">` +
                `<img src="data:image/png;base64,${printData.barcodeImage}" style="max-width:100%" />` +
                `<div style="margin-top:8px;font-size:12px;color:#333">${printData.barcodeText}</div>` +
                `</div>` +
                `</body></html>`
              const w = window.open('', '_blank')
              if (w) {
                w.document.open()
                w.document.write(html)
                w.document.close()
                setTimeout(() => {
                  try {
                    w.focus()
                    w.print()
                  } catch (e) {
                    console.log(e)
                  }
                }, 200)
              }
              printed++
            }
          }
        } catch (_) {
          // continue
        }
      }
      if (printed > 0) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Generated & sent ${printed} ACN(s) to print`,
          showConfirmButton: false,
          timer: 2200
        })
      }
      emit('generationComplete', printed)
    } else {
      const qty = parseInt(props.modelValue.quantity) || 1
      let printed = 0
      for (let i = 0; i < qty; i++) {
        try {
          const { data } = await axios.post('/acns/generate', {
            productId: selectedProduct.value._id
          })
          if (data?.success && data?.acn && data?.acnRecordId) {
            const res = await axios.get(`/barcodes/acn/${data.acnRecordId}`)
            const printData = res?.data?.printData
            if (printData?.barcodeImage) {
              const html =
                `<!doctype html><html><head><title>Print ACN ${
                  printData.acnInfo?.acnCode || ''
                }</title></head><body style="margin:0;padding:20px;font-family:Arial,sans-serif;">` +
                `<div style="text-align:center">` +
                `<img src="data:image/png;base64,${printData.barcodeImage}" style="max-width:100%" />` +
                `<div style="margin-top:8px;font-size:12px;color:#333">${printData.barcodeText}</div>` +
                `</div>` +
                `</body></html>`
              const w = window.open('', '_blank')
              if (w) {
                w.document.open()
                w.document.write(html)
                w.document.close()
                setTimeout(() => {
                  try {
                    w.focus()
                    w.print()
                  } catch (e) {
                    console.log(e)
                  }
                }, 200)
              }
              printed++
            }
          }
        } catch (_) {
          // continue
        }
      }
      if (printed > 0) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Generated & sent ${printed} ACN(s) to print`,
          showConfirmButton: false,
          timer: 2200
        })
      }
      emit('generationComplete', printed)
    }
  } catch (err) {
    const msg =
      err?.response?.status === 409
        ? 'ACN already exists for selected serial'
        : err?.response?.data?.message || 'Failed to generate/print ACN'
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error',
      text: msg,
      showConfirmButton: false,
      timer: 2500
    })
  } finally {
    acnLoading.value = false
  }
}
</script>
