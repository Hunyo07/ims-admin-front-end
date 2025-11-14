<template>
  <DefaultLayout>
    <div class="p-6 space-y-6">
      <h2 class="text-title-md2 font-bold">Create New Inventory Record</h2>

      <!-- 1) Record Header Info -->
      <div class="rounded-sm border border-stroke bg-white shadow-default p-4 space-y-3">
        <h3 class="font-semibold">Record Header Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="text-xs">Department</label>
            <input
              v-model="header.department"
              class="mt-1 w-full border rounded px-2 py-1"
              placeholder="e.g., IT"
            />
          </div>
          <div>
            <label class="text-xs">Date</label>
            <input v-model="header.date" type="date" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="text-xs">Created By</label>
            <input v-model="header.createdBy" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="text-xs">Notes (optional)</label>
            <input v-model="header.notes" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="text-xs">Record Type (optional)</label>
            <select v-model="header.recordType" class="mt-1 w-full border rounded px-2 py-1">
              <option value="">—</option>
              <option>New Deployment</option>
              <option>Replacement</option>
              <option>Repair Return</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 2) Primary Categories & Generate Cards -->
      <div class="rounded-sm border border-stroke bg-white shadow-default p-4 space-y-3">
        <h3 class="font-semibold">Select Computer Desktop / Laptop</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label class="text-xs">Desktop Quantity</label>
            <input
              v-model.number="primary.desktopQty"
              type="number"
              min="0"
              class="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label class="text-xs">Laptop Quantity</label>
            <input
              v-model.number="primary.laptopQty"
              type="number"
              min="0"
              class="mt-1 w-full border rounded px-2 py-1"
            />
          </div>
          <div class="md:col-span-1">
            <button class="px-3 py-2 text-sm border rounded" @click="generateCards">
              Generate Cards
            </button>
          </div>
        </div>
      </div>

      <!-- 3) Cards: Primary Items with Secondary Items -->
      <div
        v-for="(card, idx) in cards"
        :key="idx"
        class="rounded-sm border border-stroke bg-white shadow-default p-4 space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">
            {{ card.category === 'desktop' ? 'Desktop' : 'Laptop' }} - Card #{{ idx + 1 }}
          </h3>
          <button class="text-xs underline" @click="copyPrevious(idx)" v-if="idx > 0">
            Copy Previous Card
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="text-xs">Employee</label>
            <input
              v-model="card.employee"
              class="mt-1 w-full border rounded px-2 py-1"
              placeholder="Filtered by Department"
            />
          </div>
          <div>
            <label class="text-xs">Item</label>
            <input
              v-model="card.item"
              class="mt-1 w-full border rounded px-2 py-1"
              placeholder="Filtered by Category"
            />
          </div>
          <div>
            <label class="text-xs">ACN</label>
            <input v-model="card.acn" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="text-xs">Property Number (optional)</label>
            <input v-model="card.propertyNumber" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="text-xs">Remarks (optional)</label>
            <input v-model="card.remarks" class="mt-1 w-full border rounded px-2 py-1" />
          </div>
        </div>

        <!-- Secondary Items -->
        <div class="space-y-2">
          <button
            class="text-xs px-2 py-1 border rounded"
            @click="card.showAddSecondary = !card.showAddSecondary"
          >
            Add Secondary Item
          </button>
          <div v-if="card.showAddSecondary" class="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div>
              <label class="text-xs">Type</label>
              <select v-model="newSecondary.type" class="mt-1 w-full border rounded px-2 py-1">
                <option value="monitor">Monitor</option>
                <option value="printer">Printer</option>
                <option value="scanner">Scanner</option>
              </select>
            </div>
            <div>
              <label class="text-xs">Item</label>
              <input v-model="newSecondary.item" class="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label class="text-xs">ACN</label>
              <input v-model="newSecondary.acn" class="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label class="text-xs">Remarks (optional)</label>
              <input v-model="newSecondary.remarks" class="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs flex items-center gap-1"
                ><input type="checkbox" v-model="newSecondary.duplicate" /> Duplicate across
                cards</label
              >
              <button class="px-2 py-1 text-xs border rounded" @click="addSecondary(idx)">
                Add
              </button>
            </div>
          </div>

          <div v-if="card.secondaries.length" class="mt-2">
            <table class="w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left px-2 py-1">Type</th>
                  <th class="text-left px-2 py-1">Item</th>
                  <th class="text-left px-2 py-1">ACN</th>
                  <th class="text-left px-2 py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, sidx) in card.secondaries" :key="sidx" class="border-t">
                  <td class="px-2 py-1">{{ s.type }}</td>
                  <td class="px-2 py-1">{{ s.item }}</td>
                  <td class="px-2 py-1">{{ s.acn }}</td>
                  <td class="px-2 py-1">{{ s.remarks || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 4) Validation & Summary Preview -->
      <div class="rounded-sm border border-stroke bg-white shadow-default p-4 space-y-3">
        <h3 class="font-semibold">Validation & Summary</h3>
        <button class="px-3 py-2 text-sm border rounded" @click="validateAll">
          Run Validation
        </button>
        <div class="text-xs text-gray-600">
          <p>Cards: {{ cards.length }} • Unique ACNs: {{ acnCount }}</p>
        </div>
      </div>

      <!-- 5) Save / Submit -->
      <div class="flex gap-2">
        <button class="px-3 py-2 text-sm border rounded" @click="saveRecord">Save Record</button>
        <button class="px-3 py-2 text-sm border rounded">Save as Draft</button>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const today = new Date().toISOString().slice(0, 10)
const header = ref({
  department: '',
  date: today,
  createdBy: 'Current User',
  notes: '',
  recordType: ''
})
const primary = ref({ desktopQty: 0, laptopQty: 0 })
const cards = ref([])

function generateCards() {
  cards.value = []
  const d = Number(primary.value.desktopQty) || 0
  const l = Number(primary.value.laptopQty) || 0
  for (let i = 0; i < d; i++)
    cards.value.push({
      category: 'desktop',
      employee: '',
      item: '',
      acn: '',
      propertyNumber: '',
      remarks: '',
      secondaries: [],
      showAddSecondary: false
    })
  for (let i = 0; i < l; i++)
    cards.value.push({
      category: 'laptop',
      employee: '',
      item: '',
      acn: '',
      propertyNumber: '',
      remarks: '',
      secondaries: [],
      showAddSecondary: false
    })
}
function copyPrevious(idx) {
  cards.value[idx] = {
    ...cards.value[idx - 1],
    category: cards.value[idx].category,
    secondaries: JSON.parse(JSON.stringify(cards.value[idx - 1].secondaries))
  }
}

const newSecondary = ref({ type: 'monitor', item: '', acn: '', remarks: '', duplicate: false })
const acnsUsed = computed(() => {
  const s = new Set()
  cards.value.forEach((c) => {
    if (c.acn) s.add(c.acn)
    c.secondaries.forEach((x) => {
      if (x.acn) s.add(x.acn)
    })
  })
  return s
})
const acnCount = computed(() => acnsUsed.value.size)

function addSecondary(idx) {
  const s = { ...newSecondary.value }
  if (!s.item || !s.acn) {
    alert('Secondary Item and ACN are required')
    return
  }
  if (acnsUsed.value.has(s.acn)) {
    alert('ACN must be unique')
    return
  }
  cards.value[idx].secondaries.push(s)
  if (s.duplicate) {
    cards.value.forEach((c, i) => {
      if (i !== idx) c.secondaries.push({ ...s })
    })
  }
  newSecondary.value = { type: 'monitor', item: '', acn: '', remarks: '', duplicate: false }
}

function validateAll() {
  const errs = []
  cards.value.forEach((c, i) => {
    if (!c.employee) errs.push(`Card ${i + 1}: Employee required`)
    if (!c.item) errs.push(`Card ${i + 1}: Item required`)
    if (!c.acn) errs.push(`Card ${i + 1}: ACN required`)
  })
  if (errs.length) {
    alert(errs.join('\n'))
    return false
  } else {
    alert('Validation passed')
    return true
  }
}
function saveRecord() {
  if (!validateAll()) return
  alert('Record saved (stub). A real save would call the API.')
}
</script>
