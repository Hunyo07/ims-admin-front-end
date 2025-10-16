<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  serials: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Filter serials…' }
})

const emit = defineEmits(['update:modelValue'])

const filter = ref('')
const selected = ref(Array.isArray(props.modelValue) ? [...props.modelValue] : [])

watch(
  () => props.modelValue,
  (val) => {
    selected.value = Array.isArray(val) ? [...val] : []
  }
)

const filteredSerials = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const list = Array.isArray(props.serials) ? props.serials : []
  if (!f) return list
  return list.filter((sn) => sn.toLowerCase().includes(f))
})

const selectedCount = computed(() => selected.value.length)
const limitReached = computed(() => props.limit > 0 && selectedCount.value >= props.limit)

function updateSelected(next) {
  const unique = Array.from(new Set(next))
  const limited = props.limit > 0 ? unique.slice(0, props.limit) : unique
  selected.value = limited
  emit('update:modelValue', limited)
}

function toggle(sn) {
  const idx = selected.value.indexOf(sn)
  if (idx >= 0) {
    const next = [...selected.value]
    next.splice(idx, 1)
    updateSelected(next)
  } else {
    if (limitReached.value && props.limit > 0) return
    updateSelected([...selected.value, sn])
  }
}

function selectAll() {
  const currentSet = new Set(selected.value)
  const remaining = props.limit > 0 ? props.limit - currentSet.size : Infinity
  if (remaining <= 0) return
  const candidates = filteredSerials.value.filter((sn) => !currentSet.has(sn)).slice(0, remaining)
  updateSelected([...selected.value, ...candidates])
}

function clearAll() {
  updateSelected([])
}
</script>

<template>
  <div>
    <div class="grid grid-cols-1 md:grid-cols-12 gap-2 mb-2">
      <div class="md:col-span-6">
        <input
          v-model="filter"
          :placeholder="placeholder"
          type="text"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
          :disabled="disabled"
        />
      </div>
      <div class="md:col-span-6 text-right text-[11px] text-bodydark2 self-center">
        Selected {{ selectedCount }}
        <span v-if="limit > 0">of {{ limit }}</span>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-2" v-if="selected.length">
      <span
        v-for="sn in selected"
        :key="sn"
        class="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded dark:bg-meta-4 dark:text-white"
      >
        {{ sn }}
        <button
          type="button"
          class="text-indigo-700 hover:text-indigo-900 dark:text-white"
          @click="toggle(sn)"
          :disabled="disabled"
          aria-label="Remove"
        >
          ×
        </button>
      </span>
    </div>

    <div class="h-40 overflow-y-auto border border-stroke rounded">
      <ul>
        <li
          v-for="sn in filteredSerials"
          :key="sn"
          class="flex items-center justify-between px-3 py-2 border-b border-stroke last:border-0"
        >
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="selected.includes(sn)"
              @change="toggle(sn)"
              :disabled="disabled || (limitReached && !selected.includes(sn))"
            />
            <span>{{ sn }}</span>
          </label>
        </li>
      </ul>
    </div>

    <div class="mt-2 flex items-center gap-2">
      <button
        type="button"
        class="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-opacity-90 text-xs"
        @click="selectAll"
        :disabled="disabled || filteredSerials.length === 0 || limitReached"
      >
        Auto-select
      </button>
      <button
        type="button"
        class="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400 text-xs"
        @click="clearAll"
        :disabled="disabled || selected.length === 0"
      >
        Clear
      </button>
      <p class="text-[11px] text-bodydark2">
        <span v-if="limit > 0">Select up to {{ limit }} serial(s).</span>
        <span v-else>Selection not limited.</span>
      </p>
    </div>
  </div>
</template>