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

const fetchProductName = async (pid) => {
  try {
    if (!pid) return ''
    const { data } = await axios.get(`/products/${pid}`)
    return data?.product?.name || ''
  } catch (_) {
    return ''
  }
}

const selectAcn = async (opt) => {
  emit('update:modelValue', opt.acnCode)
  try {
    const { data } = await axios.get('/inventory-records', {
      params: { acn: opt.acnCode, status: 'deployed', limit: 1 }
    })
    const rec = (data?.records || [])[0]
    let item = null
    let isSecondary = false
    if (rec && Array.isArray(rec.items)) {
      item = rec.items.find(
        (it) => String(it.acn || '').toUpperCase() === String(opt.acnCode).toUpperCase()
      )
      if (!item) {
        const parent = rec.items.find(
          (it) =>
            Array.isArray(it.secondaryItems) &&
            it.secondaryItems.some(
              (s) => String(s.acn || '').toUpperCase() === String(opt.acnCode).toUpperCase()
            )
        )
        if (parent) {
          isSecondary = true
          const sec = parent.secondaryItems.find(
            (s) => String(s.acn || '').toUpperCase() === String(opt.acnCode).toUpperCase()
          )
          item = {
            ...parent,
            _selectedSecondary: sec
          }
        }
      }
    }
    if (!item && opt.isSecondary) {
      isSecondary = true
      item = {
        endUserOrMR: opt.endUserOrMR || '',
        _selectedSecondary: opt.secondary || {}
      }
    }
    // Attach product names when possible
    try {
      if (isSecondary) {
        const sec = item?._selectedSecondary || {}
        const pid = sec.productId || sec.product || opt.product || ''
        const pname = typeof pid === 'string' ? await fetchProductName(pid) : pid?.name || ''
        if (pname) item._selectedSecondary = { ...sec, productName: pname }
      } else if (item) {
        const pid = item.product
        const pname = typeof pid === 'string' ? await fetchProductName(pid) : pid?.name || ''
        if (pname) item.productName = pname
      }
    } catch (_) {
      console.log(_)
    }
    emit('select', {
      acn: opt.acnCode,
      product: opt.product,
      record: rec || (opt?.department ? { _id: opt.recordId, department: opt.department } : null),
      item: item || null,
      isSecondary
    })
  } catch (_) {
    const fallbackItem = opt?.isSecondary
      ? { endUserOrMR: opt.endUserOrMR || '', _selectedSecondary: opt.secondary || {} }
      : { endUserOrMR: opt.endUserOrMR || '' }
    const fallbackRecord = opt?.department
      ? { _id: opt.recordId, department: opt.department }
      : null
    emit('select', {
      acn: opt.acnCode,
      product: opt.product,
      record: fallbackRecord,
      item: fallbackItem,
      isSecondary: opt?.isSecondary || false
    })
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
    const params = { status: 'deployed', limit: 20, page: 1 }
    const q = String(search.value || '').trim()
    if (q) {
      const hasLetter = /[A-Za-z]/.test(q)
      if (hasLetter) params.acn = q
      else params.serialNumber = q
    }
    const { data } = await axios.get('/inventory-records', { params })
    const records = Array.isArray(data?.records) ? data.records : []
    const opts = []
    for (const rec of records) {
      for (const it of rec.items || []) {
        if (it?.status !== 'deployed') continue
        const parent = it
        if (parent?.acn) {
          opts.push({
            _id: parent._id,
            acnCode: parent.acn,
            product: parent.product || null,
            description: parent.description || '',
            endUserOrMR: parent.endUserOrMR || '',
            isSecondary: false,
            recordId: rec._id,
            department: (rec?.department && rec?.department?.name) || rec?.department || '',
            itemId: parent._id
          })
        }
        for (const sec of parent.secondaryItems || []) {
          if (!sec?.acn) continue
          opts.push({
            _id: `${parent._id}-sec-${sec.acn}`,
            acnCode: sec.acn,
            product: sec.productId || null,
            description: `${(sec.type || '').toUpperCase()} ${
              sec.propertyNumber ? '• ' + sec.propertyNumber : ''
            }`.trim(),
            endUserOrMR: parent.endUserOrMR || '',
            isSecondary: true,
            recordId: rec._id,
            department: (rec?.department && rec?.department?.name) || rec?.department || '',
            itemId: parent._id,
            secondary: {
              propertyNumber: sec.propertyNumber || '',
              serialNumber: sec.serialNumber || '',
              remarksYears: sec.remarksYears || ''
            }
          })
        }
      }
    }
    if (!q) {
      options.value = opts
    } else {
      const s = q.toLowerCase()
      options.value = opts.filter((o) =>
        [o.acnCode, o.description, o.endUserOrMR]
          .map((v) => String(v || '').toLowerCase())
          .some((v) => v.includes(s))
      )
    }
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
            <div class="flex items-center gap-2">
              <div class="font-medium">{{ opt.acnCode }}</div>
              <span
                v-if="opt.isSecondary"
                class="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-bodydark2"
                >secondary</span
              >
            </div>
            <div class="text-xs text-bodydark2">
              {{ opt.description || '—' }}
            </div>
            <div class="text-[11px] text-bodydark2">User: {{ opt.endUserOrMR || '—' }}</div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
