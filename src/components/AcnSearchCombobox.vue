<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from '@/utils/axios'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search ACN or Serial' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select'])

const search = ref('')
const isOpen = ref(false)
const loading = ref(false)
const options = ref([])
const error = ref('')
let debounceTimer = null

const formatLabel = (rec) => {
  const acn = rec.acnCode || rec.acn || ''
  const name = rec.product?.name || 'Unknown Product'
  const serial = rec.serialNumber ? `• SN: ${rec.serialNumber}` : ''
  return `${acn} — ${name} ${serial}`.trim()
}

const fetchACNs = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { limit: 10 }
    if (search.value) params.search = search.value
    const { data } = await axios.get('/acns', { params })
    const arr = Array.isArray(data?.acns) ? data.acns : []
    options.value = arr
  } catch (e) {
    options.value = []
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

const openIfNot = () => {
  if (!isOpen.value) isOpen.value = true
}

const onInput = (e) => {
  search.value = e.target.value
  openIfNot()
}

const onFocus = () => {
  openIfNot()
  if (!options.value.length) fetchACNs()
}

const selectAcn = (rec) => {
  const code = rec.acnCode || rec.acn || ''
  emit('update:modelValue', code)
  emit('select', rec)
  isOpen.value = false
}

const clearSelection = () => {
  emit('update:modelValue', '')
  search.value = ''
  isOpen.value = true
  fetchACNs()
}

watch(
  () => search.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fetchACNs, 250)
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
        :value="modelValue || search"
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
        v-if="modelValue"
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
            v-for="rec in options"
            :key="rec._id"
            @click="selectAcn(rec)"
            class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
          >
            <div class="font-medium">{{ formatLabel(rec) }}</div>
            <div class="text-xs text-bodydark2">
              SKU: {{ rec.product?.sku || '—' }} • Category:
              {{ rec.product?.category?.name || '—' }}
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
