<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from '@/utils/axios'

const props = defineProps({
  modelValue: { type: String, default: '' },
  department: { type: String, default: '' },
  placeholder: { type: String, default: 'Search employee' },
  disabled: { type: Boolean, default: false },
  limit: { type: Number, default: 100 },
  strictDepartment: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select'])

const search = ref('')
const isOpen = ref(false)
const loading = ref(false)
const options = ref([])
const error = ref('')
let debounceTimer = null
const departments = ref([])
const deptMap = ref(new Map())

const fullName = (emp) => `${emp.firstName || ''} ${emp.lastName || ''}`.trim()

const loadDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const list = Array.isArray(data?.departments) ? data.departments : Array.isArray(data) ? data : []
    departments.value = list
    const m = new Map()
    for (const d of list) {
      const name = String(d?.name || '').trim().toLowerCase()
      const code = String(d?.code || '').trim().toLowerCase()
      if (name) m.set(name, code || name)
      if (code) m.set(code, code)
    }
    deptMap.value = m
  } catch (_) {
    departments.value = []
    deptMap.value = new Map()
  }
}

const resolveDeptQuery = () => {
  const d = String(props.department || '').trim().toLowerCase()
  if (!d) return ''
  return deptMap.value.get(d) || d
}

const fetchEmployees = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (search.value) params.search = search.value
    if (props.department) params.department = resolveDeptQuery()
    params.limit = props.limit
    const { data } = await axios.get('/employees', { params })
    let list = Array.isArray(data?.employees) ? data.employees : []
    if (!list || list.length === 0) {
      const p2 = {}
      if (search.value) p2.search = search.value
      p2.limit = params.limit
      const { data: d2 } = await axios.get('/employees', { params: p2 })
      list = Array.isArray(d2?.employees) ? d2.employees : []
    }
    if (props.strictDepartment && props.department) {
      const norm = (s) => String(s || '').trim().toLowerCase()
      const target = norm(props.department)
      const targetCode = resolveDeptQuery()
      list = (list || []).filter((e) => {
        const candidates = [
          e?.department,
          e?.departmentName,
          e?.departmentCode,
          e?.department?.name,
          e?.department?.code
        ]
          .map((v) => norm(v))
          .filter(Boolean)
        const match = candidates.some((ed) => ed === target || ed === targetCode || ed.includes(target) || target.includes(ed) || ed.includes(targetCode) || targetCode.includes(ed))
        return match
      })
    }
    options.value = list || []
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
  // Keep parent v-model in sync even when typing free text
  emit('update:modelValue', search.value)
  openIfNot()
}

const onFocus = () => {
  openIfNot()
  // Initial load
  if (!options.value.length) fetchEmployees()
}

const selectEmployee = (emp) => {
  const name = fullName(emp)
  emit('update:modelValue', name)
  emit('select', emp)
  isOpen.value = false
}

const clearSelection = () => {
  emit('update:modelValue', '')
  search.value = ''
  isOpen.value = true
  fetchEmployees()
}

// Debounce search
watch(
  () => search.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fetchEmployees, 250)
  }
)

// Refetch when department changes
watch(
  () => props.department,
  () => {
    fetchEmployees()
    if (props.strictDepartment) search.value = ''
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
  loadDepartments()
  fetchEmployees()
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
            v-for="emp in options"
            :key="emp._id"
            @click="selectEmployee(emp)"
            class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
          >
            <div class="font-medium">{{ fullName(emp) }}</div>
            <div class="text-xs text-bodydark2">
              {{ emp.phoneNumber || emp.email || '—' }} • {{ emp.department || '—' }}
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
