<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from '@/utils/axios'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search ACN' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select'])

const search = ref('')
const isOpen = ref(false)
const loading = ref(false)
const options = ref([])
const error = ref('')
let debounceTimer = null

const openIfNot = () => {
  if (!isOpen.value) isOpen.value = true
}

const onInput = (e) => {
  search.value = e.target.value
  openIfNot()
}

const onFocus = () => {
  openIfNot()
  if (!options.value.length) fetchOptions()
}

const close = () => {
  isOpen.value = false
}

const selectAcn = async (opt) => {
  emit('update:modelValue', opt.acnCode)
  // Try to load deployed item details for this ACN
  try {
    const { data } = await axios.get('/inventory-records', {
      params: { acn: opt.acnCode, status: 'deployed', limit: 1 }
    })
    const rec = (data?.records || [])[0]
    let item = null
    if (rec && Array.isArray(rec.items)) {
      item = rec.items.find((it) => String(it.acn).toUpperCase() === String(opt.acnCode).toUpperCase())
    }
    emit('select', {
      acn: opt.acnCode,
      product: opt.product,
      record: rec || null,
      item: item || null
    })
  } catch (_) {
    emit('select', { acn: opt.acnCode, product: opt.product, record: null, item: null })
  }
  close()
}

const clearSelection = () => {
  emit('update:modelValue', '')
  search.value = ''
  isOpen.value = true
  fetchOptions()
}

const fetchOptions = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { limit: 20 }
    const q = String(search.value || '').trim()
    if (q) params.search = q
    // Base ACN list
    const { data } = await axios.get('/acns', { params })
    const acns = Array.isArray(data?.acns) ? data.acns : []
    const codes = acns.map((a) => String(a.acnCode).toUpperCase())

    // Check assignment/deployment status
    let assignments = {}
    if (codes.length) {
      try {
        const res = await axios.post('/acns/assignment-status', { acnCodes: codes })
        assignments = res?.data?.assignments?.acn || {}
      } catch (e) {
        assignments = {}
      }
    }

    // Only show ACNs currently assigned/deployed
    options.value = acns
      .filter((a) => {
        const key = String(a.acnCode).toUpperCase()
        const asn = assignments[key]
        return asn && asn.assigned && (asn.status === 'deployed' || asn.status === 'under_repair')
      })
      .map((a) => ({
        _id: a._id,
        acnCode: a.acnCode,
        product: a.product
      }))
  } catch (e) {
    options.value = []
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

// Debounce search
watch(
  () => search.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fetchOptions, 250)
  }
)

// Close on outside click
const root = ref(null)
const onDocClick = (e) => {
  if (!root.value) return
  if (!root.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
})
</script>

<template>
  <div ref="root" class="relative">
    <div class="flex items-center gap-2">
      <input
        :value="props.modelValue || search"
        @input="onInput"
        @focus="onFocus"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
      />
      <button
        type="button"
        @click="clearSelection"
        class="text-xs text-bodydark2 hover:text-danger"
        v-if="props.modelValue"
      >
        Clear
      </button>
    </div>

    <div
      v-if="isOpen"
      class="absolute left-0 right-0 mt-1 bg-white rounded shadow z-10 border border-gray-200 max-h-64 overflow-auto"
    >
      <div v-if="loading" class="px-3 py-2 text-sm text-bodydark2">Loading...</div>
      <div v-else-if="error" class="px-3 py-2 text-sm text-danger">{{ error }}</div>
      <template v-else>
        <div v-if="!options.length" class="px-3 py-2 text-sm text-bodydark2">No matches</div>
        <ul v-else>
          <li
            v-for="opt in options"
            :key="opt._id"
            @click="selectAcn(opt)"
            class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
          >
            <div class="font-medium">{{ opt.acnCode }}</div>
            <div class="text-xs text-bodydark2">
              {{ opt.product?.name || '—' }} • {{ opt.product?.sku || '' }}
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>