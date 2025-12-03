<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import axios from '@/utils/axios'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search deployed ACN' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select'])

const search = ref('')
const isOpen = ref(false)
const loading = ref(false)
const options = ref([])
const error = ref('')
let debounceTimer = null
const debugOpen = ref(false)
const debugInfo = ref({
  params: null,
  primaryRecords: 0,
  fallbackRecords: 0,
  options: 0,
  error: ''
})
const dbgTag = '[ACN-REPAIR-DEBUG]'
const dbg = (...args) => {
  try {
    console.log(dbgTag, ...args)
  } catch (_) {
    void 0
  }
}

const openIfNot = () => {
  if (!isOpen.value) isOpen.value = true
}

const onInput = (e) => {
  search.value = e.target.value
  openIfNot()
  emit('update:modelValue', search.value)
}

const onKeydown = (e) => {
  if (e.key === 'Enter') {
    const code = String(search.value || '').trim()
    if (code) selectAcn({ acnCode: code })
  }
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
  dbg('selectAcn called with opt:', { acnCode: opt?.acnCode, isSecondary: !!opt?.isSecondary })
  emit('update:modelValue', opt.acnCode)
  try {
    let { data } = await axios.get('/inventory-records', {
      params: { acn: opt.acnCode, limit: 1 }
    })
    let rec = (data?.records || [])[0]
    if (!rec) {
      dbg('primary lookup by ACN returned 0 records; trying fallback scan')
      const fb = await axios.get('/inventory-records', { params: { limit: 200 } })
      const list = fb?.data?.records || []
      dbg('fallback records count:', list.length)
      rec =
        list.find((r) =>
          (r.items || []).some((it) => {
            const code = String(opt.acnCode || '').toUpperCase()
            const matchPrimary = String(it?.acn || '').toUpperCase() === code
            const matchPrimaryProp = String(it?.propertyNumber || '').toUpperCase() === code
            const matchSecondary = (it?.secondaryItems || []).some(
              (s) =>
                String(s?.acn || '').toUpperCase() === code ||
                String(s?.propertyNumber || '').toUpperCase() === code
            )
            return matchPrimary || matchPrimaryProp || matchSecondary
          })
        ) || null
    }
    let item = null
    let isSecondary = false
    if (rec && Array.isArray(rec.items)) {
      const code = String(opt.acnCode || '').toUpperCase()
      item = rec.items.find((it) => {
        return (
          String(it.acn || '').toUpperCase() === code ||
          String(it.propertyNumber || '').toUpperCase() === code
        )
      })
      if (!item) {
        const parent = rec.items.find(
          (it) =>
            Array.isArray(it.secondaryItems) &&
            it.secondaryItems.some(
              (s) =>
                String(s.acn || '').toUpperCase() === code ||
                String(s.propertyNumber || '').toUpperCase() === code
            )
        )
        if (parent) {
          isSecondary = true
          const sec = parent.secondaryItems.find(
            (s) =>
              String(s.acn || '').toUpperCase() === code ||
              String(s.propertyNumber || '').toUpperCase() === code
          )
          item = { ...parent, _selectedSecondary: sec }
        }
      }
    }
    if (!item && opt.isSecondary) {
      isSecondary = true
      item = { endUserOrMR: opt.endUserOrMR || '', _selectedSecondary: opt.secondary || {} }
    }
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
      void 0
    }
    dbg('selection resolved:', {
      recordFound: !!rec,
      itemFound: !!item,
      isSecondary,
      serialResolved: isSecondary
        ? item?._selectedSecondary?.serialNumber || ''
        : item?.serialNumber || ''
    })
    emit('select', {
      acn: opt.acnCode,
      product: opt.product,
      serialNumber:
        String(opt.serialNumber || '') ||
        (isSecondary
          ? String(item?._selectedSecondary?.serialNumber || '')
          : String(item?.serialNumber || '')),
      record: rec || (opt?.department ? { _id: opt.recordId, department: opt.department } : null),
      item: item || null,
      isSecondary
    })
  } catch (_) {
    dbg('selection error:', String(_?.message || _))
    const fallbackItem = opt?.isSecondary
      ? {
          endUserOrMR: opt.endUserOrMR || '',
          _selectedSecondary: opt.secondary || {},
          serialNumber: opt.serialNumber || ''
        }
      : { endUserOrMR: opt.endUserOrMR || '', serialNumber: opt.serialNumber || '' }
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
    const q = String(search.value || '').trim()
    const qUpper = q.toUpperCase()
    const paramsPrimary = q
      ? { acn: qUpper, status: 'deployed', limit: 150, page: 1 }
      : { status: 'deployed', limit: 300, page: 1 }
    dbg('fetchOptions params:', paramsPrimary)
    debugInfo.value.params = paramsPrimary
    let { data } = await axios.get('/inventory-records', { params: paramsPrimary })
    let records = Array.isArray(data?.records) ? data.records : []
    dbg('primary fetch records:', records.length)
    debugInfo.value.primaryRecords = records.length
    if (!records || records.length === 0) {
      const fb = await axios.get('/inventory-records', {
        params: { status: 'deployed', limit: 500, page: 1 }
      })
      records = Array.isArray(fb?.data?.records) ? fb.data.records : []
      dbg('fallback fetch records:', records.length)
      debugInfo.value.fallbackRecords = records.length
      // Do not include stock ACNs; only deployed items should be shown
      if (!records.length) {
        options.value = []
        debugInfo.value.options = 0
        return
      }
    }
    const opts = []
    let primCount = 0
    let secCount = 0
    const activeRepairStatuses = ['under_repair', 'on_going', 'for_replacement', 'beyond_repair', 'ready_to_claim']
    for (const rec of records) {
      for (const it of rec.items || []) {
        const st = String(it?.status || '').toLowerCase()
        const allowed = ['deployed']
        if (!allowed.includes(st)) continue
        const repairSt = String(it?.repairStatus || '').toLowerCase()
        if (activeRepairStatuses.includes(repairSt)) continue
        const acnPattern = /^[A-Z]{3}-\d{3}-\d{2}-\d{4}$/
        const parentCode =
          it?.acn ||
          (acnPattern.test(String(it?.propertyNumber || '').toUpperCase())
            ? String(it?.propertyNumber || '').toUpperCase()
            : '')
        if (parentCode) {
          opts.push({
            _id: it._id,
            acnCode: parentCode,
            product: it.product || null,
            description: it.description || '',
            endUserOrMR: it.endUserOrMR || '',
            isSecondary: false,
            recordId: rec._id,
            department: (rec?.department && rec?.department?.name) || rec?.department || '',
            itemId: it._id,
            serialNumber: it.serialNumber || ''
          })
          primCount++
        }
        for (const sec of it.secondaryItems || []) {
          const secCode =
            sec?.acn ||
            (acnPattern.test(String(sec?.propertyNumber || '').toUpperCase())
              ? String(sec?.propertyNumber || '').toUpperCase()
              : '')
          if (!secCode) continue
          const secRepairSt = String(sec?.repairStatus || '').toLowerCase()
          if (activeRepairStatuses.includes(secRepairSt)) continue
          opts.push({
            _id: `${it._id}-sec-${sec.acn || sec.propertyNumber || ''}`,
            acnCode: secCode,
            product: sec.productId || null,
            description: `${(sec.type || '').toUpperCase()} ${
              sec.propertyNumber ? '• ' + sec.propertyNumber : ''
            }`.trim(),
            endUserOrMR: it.endUserOrMR || '',
            isSecondary: true,
            recordId: rec._id,
            department: (rec?.department && rec?.department?.name) || rec?.department || '',
            itemId: it._id,
            secondary: {
              propertyNumber: sec.propertyNumber || '',
              serialNumber: sec.serialNumber || '',
              remarksYears: sec.remarksYears || ''
            },
            serialNumber: sec.serialNumber || ''
          })
          secCount++
        }
      }
    }
    dbg('built options:', { primCount, secCount, total: opts.length })
    debugInfo.value.options = opts.length
    if (!q) options.value = opts
    else {
      const s = qUpper
      options.value = opts.filter((o) =>
        String(o.acnCode || '')
          .toUpperCase()
          .includes(s)
      )
      if (!options.value.length) {
        const slow = opts.filter((o) =>
          [o.description, o.endUserOrMR]
            .map((v) => String(v || '').toLowerCase())
            .some((v) => v.includes(q.toLowerCase()))
        )
        options.value = slow
      }
      dbg('filtered options by search:', { q, count: options.value.length })
      if (!options.value.length) {
        options.value = []
        debugInfo.value.options = 0
      }
    }
  } catch (e) {
    dbg('fetchOptions error:', String(e?.message || e))
    debugInfo.value.error = e?.response?.data?.message || e.message || String(e)
    options.value = []
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

const filteredOptions = computed(() => options.value)

watch(
  () => search.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fetchOptions, 250)
  }
)

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
        @keydown="onKeydown"
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
      <button
        type="button"
        @click="debugOpen = !debugOpen"
        class="text-xs text-bodydark2 hover:text-primary"
      >
        Debug
      </button>
    </div>

    <div
      v-if="isOpen"
      class="absolute left-0 right-0 mt-1 bg-white rounded shadow z-10 border border-gray-200 max-h-64 overflow-auto"
    >
      <div v-if="loading" class="px-3 py-2 text-sm text-bodydark2">Loading...</div>
      <div v-else-if="error" class="px-3 py-2 text-sm text-danger">{{ error }}</div>
      <template v-else>
        <div v-if="!filteredOptions.length" class="px-3 py-2 text-sm text-bodydark2">
          No matches
        </div>
        <ul v-else>
          <li
            v-for="opt in filteredOptions"
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
            <div class="text-xs text-bodydark2">{{ opt.description || '—' }}</div>
            <div class="text-[11px] text-bodydark2">User: {{ opt.endUserOrMR || '—' }}</div>
          </li>
        </ul>
      </template>
    </div>
    <div v-if="debugOpen" class="mt-2 border border-stroke rounded p-2 text-xs text-bodydark2">
      <div>Params: {{ JSON.stringify(debugInfo.params) }}</div>
      <div>Primary records: {{ debugInfo.primaryRecords }}</div>
      <div>Fallback records: {{ debugInfo.fallbackRecords }}</div>
      <div>Options: {{ debugInfo.options }}</div>
      <div v-if="debugInfo.error">Error: {{ debugInfo.error }}</div>
    </div>
  </div>
</template>
