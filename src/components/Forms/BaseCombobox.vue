<script setup>
import { ref, watch, computed, getCurrentInstance } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, Object], default: '' },
  options: { type: Array, default: () => [] },
  labelKey: { type: String, default: 'label' },
  valueKey: { type: String, default: 'value' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const query = ref('')
const highlightIndex = ref(0)
let blurTimer = null

// Stable ID for aria-controls / list element
const instance = getCurrentInstance()
const listId = `cb-list-${instance?.uid ?? Math.random().toString(36).slice(2)}`

const normalizeOption = (opt) => {
  if (opt == null) return { label: '', value: '' }
  if (typeof opt === 'string' || typeof opt === 'number') {
    return { label: String(opt), value: opt }
  }
  return { label: String(opt?.[props.labelKey] ?? ''), value: opt?.[props.valueKey] }
}

const normalizedOptions = computed(() => (props.options || []).map(normalizeOption))

const selectedLabel = computed(() => {
  const val = props.modelValue
  const found = normalizedOptions.value.find((o) => String(o.value) === String(val))
  return found?.label ?? ''
})

watch(
  () => props.modelValue,
  () => {
    query.value = selectedLabel.value
  },
  { immediate: true }
)

const filteredOptions = computed(() => {
  const q = String(query.value || '')
    .trim()
    .toLowerCase()
  const all = normalizedOptions.value
  if (!q) return all
  return all.filter((o) => o.label.toLowerCase().includes(q))
})

function open() {
  if (props.disabled) return
  isOpen.value = true
  highlightIndex.value = 0
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
}
function close() {
  isOpen.value = false
}
function closeLater() {
  blurTimer = setTimeout(() => {
    close()
  }, 150)
}
function moveHighlight(delta) {
  const max = filteredOptions.value.length
  if (max === 0) return
  highlightIndex.value = Math.max(0, Math.min(max - 1, highlightIndex.value + delta))
}
function selectOption(opt) {
  // Accept already-normalized options; fallback to normalizing raw options
  const n =
    opt && typeof opt === 'object' && 'label' in opt && 'value' in opt ? opt : normalizeOption(opt)
  emit('update:modelValue', n.value)
  emit('change', n.value)
  query.value = n.label
  close()
}
function selectHighlighted() {
  const list = filteredOptions.value
  if (list.length === 0) return
  const opt = list[Math.max(0, Math.min(highlightIndex.value, list.length - 1))]
  selectOption(opt)
}
function clearSelection() {
  emit('update:modelValue', '')
  emit('change', '')
  query.value = ''
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center space-x-2">
      <input
        :value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full rounded border border-stroke p-2"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="listId"
        @input="
          (e) => {
            query = e.target.value
            open()
            highlightIndex = 0
          }
        "
        @focus="open"
        @keydown.down.prevent="moveHighlight(1)"
        @keydown.up.prevent="moveHighlight(-1)"
        @keydown.enter.prevent="selectHighlighted()"
        @keydown.esc.prevent="close()"
        @blur="closeLater"
      />
      <button
        v-if="clearable && String(modelValue) !== ''"
        type="button"
        @click="clearSelection"
        class="text-xs px-2 py-1 rounded border border-stroke hover:bg-gray-50"
      >
        Clear
      </button>
    </div>
    <ul
      v-if="isOpen"
      :id="listId"
      class="absolute z-10 mt-1 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded shadow max-h-48 overflow-auto"
    >
      <li v-for="(o, idx) in filteredOptions" :key="String(o.value) + '-' + idx">
        <button
          type="button"
          @mousedown.prevent.stop="selectOption(o)"
          @click="selectOption(o)"
          :class="[
            'w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-meta-4',
            idx === highlightIndex ? 'bg-gray-100 dark:bg-meta-3' : ''
          ]"
        >
          {{ o.label }}
        </button>
      </li>
      <li v-if="filteredOptions.length === 0" class="px-3 py-2 text-sm text-gray-500">
        No matches
      </li>
    </ul>
  </div>
</template>
