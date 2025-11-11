<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../../utils/axios'
import { socket } from '../../socket'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import SerialPicker from '../../components/Inventory/SerialPicker.vue'

const route = useRoute()
const router = useRouter()

const pageTitle = ref('Requisition Issue Slip Details')
const ris = ref(null)
const loading = ref(true)
const error = ref(null)
const issuing = ref(false)
const successMessage = ref(null)
const downloading = ref(false)
// UI view toggles
const deploymentView = ref('cards')
const summaryView = ref('cards')

// key: productId (string), value: quantity to issue
const issueQuantities = ref({})
// Serial selection per productId
const selectedSerials = ref({})
// Available serials fetched per productId
const productSerials = ref({})
// Filter text per productId for serial list
const serialFilters = ref({})

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

// Status classes
const getStatusClass = (status) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-warning text-white'
    case 'issued':
      return 'bg-success text-white'
    case 'cancelled':
      return 'bg-danger text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

// Compute remaining quantity
const remainingQty = computed(() => {
  if (!ris.value) return {}
  const result = {}
  ris.value.items.forEach((item) => {
    result[typeof item.product === 'string' ? item.product : item.product._id] =
      item.requestedQty - item.issuedQty
  })
  return result
})

// Check if all items fully issued
const isFullyIssued = computed(() => {
  if (!ris.value) return false
  return ris.value.items.every((item) => {
    const issued = item.issuedQty || 0
    return issued >= item.requestedQty
  })
})

// Fetch RIS from API
async function fetchRIS() {
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.get(`/ris/${route.params.id}`)

    ris.value = {
      ...data.ris,
      items: data.ris.items.map((item) => ({
        ...item,
        productId: typeof item.product === 'string' ? item.product : item.product._id,
        issuedQty: item.issuedQty || 0
      }))
    }

    // Initialize issueQuantities with remaining quantities
    ris.value.items.forEach((item) => {
      const remaining = item.requestedQty - item.issuedQty
      issueQuantities.value[item.productId] = remaining > 0 ? remaining : 0
    })

    // Fetch product details to know if serials are required and available
    await Promise.all(
      (ris.value.items || []).map(async (item) => {
        try {
          const { data } = await axios.get(`/products/${item.productId}`)
          const p = data.product
          // Attach flag to item
          item.hasSerialNumbers = !!p?.hasSerialNumbers
          // Store available serials
          productSerials.value[item.productId] = Array.isArray(p?.serialNumbers)
            ? p.serialNumbers
            : []
          // Initialize selected serials
          selectedSerials.value[item.productId] = []
        } catch (e) {
          // Non-blocking: default to no serials
          item.hasSerialNumbers = false
          productSerials.value[item.productId] = []
          selectedSerials.value[item.productId] = []
        }
      })
    )
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

// Issue items
const issue = async () => {
  if (!ris.value) return

  // Only send positive quantities
  const payload = {}
  ris.value.items.forEach((item) => {
    const productId = typeof item.product === 'string' ? item.product : item.product._id
    const qty = issueQuantities.value[productId] || 0
    if (qty > 0) payload[productId] = qty
  })

  if (Object.keys(payload).length === 0) {
    error.value = 'Please enter quantities to issue'
    return
  }

  issuing.value = true
  error.value = null
  successMessage.value = null

  try {
    // Build serial numbers payload for items that require them
    const serialsPayload = {}
    for (const item of ris.value.items) {
      const productId = typeof item.product === 'string' ? item.product : item.product._id
      const qty = issueQuantities.value[productId] || 0
      if (qty > 0 && item.hasSerialNumbers) {
        const selected = selectedSerials.value[productId] || []
        if (selected.length !== qty) {
          error.value = `Select ${qty} serial number(s) for ${item.name}`
          issuing.value = false
          return
        }
        serialsPayload[productId] = selected
      }
    }

    const { data } = await axios.post(`/ris/${ris.value._id}/issue`, {
      issueQuantities: payload,
      serialNumbers: serialsPayload
    })
    successMessage.value = 'Items issued successfully'

    // Update local issuedQty
    data.ris.items.forEach((item) => {
      const productId = typeof item.product === 'string' ? item.product : item.product._id
      const localItem = ris.value?.items.find((i) => {
        const id = typeof i.product === 'string' ? i.product : i.product._id
        return id === productId
      })
      if (localItem) localItem.issuedQty = item.issuedQty
    })

    // Reset inputs
    Object.keys(issueQuantities.value).forEach((key) => (issueQuantities.value[key] = 0))
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    issuing.value = false
  }
}

// Enforce selection cap and uniqueness for serials during issuance
function onSerialChangeForProduct(productId, requestedQty) {
  const max = parseInt(requestedQty) || 0
  const arr = Array.isArray(selectedSerials.value[productId])
    ? selectedSerials.value[productId]
    : []
  const unique = Array.from(new Set(arr))
  if (unique.length > max) unique.splice(max)
  selectedSerials.value[productId] = unique
}

// Auto-select up to requestedQty serials from filtered options for issuance
function autoSelectSerialsForProduct(productId, requestedQty) {
  const max = parseInt(requestedQty) || 0
  const current = Array.isArray(selectedSerials.value[productId])
    ? selectedSerials.value[productId]
    : []
  const needed = Math.max(0, max - current.length)
  const filter = (serialFilters.value[productId] || '').toLowerCase()
  const candidates = (productSerials.value[productId] || [])
    .filter((sn) => !filter || sn.toLowerCase().includes(filter))
    .filter((sn) => !current.includes(sn))
    .slice(0, needed)
  selectedSerials.value[productId] = current.concat(candidates)
}

// Approve RIS
const approve = async () => {
  if (!ris.value) return
  try {
    issuing.value = true
    error.value = null
    const { data } = await axios.post(`/ris/${ris.value._id}/approve`)
    successMessage.value = 'RIS approved successfully'
    // Refresh RIS state with response
    ris.value = {
      ...data.ris,
      items: data.ris.items.map((item) => ({
        ...item,
        productId: typeof item.product === 'string' ? item.product : item.product._id,
        issuedQty: item.issuedQty || 0
      }))
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    issuing.value = false
  }
}

// Socket listener
const handleRISUpdated = (updatedRIS) => {
  if (ris.value && updatedRIS._id === ris.value._id) {
    fetchRIS()
  }
}

onMounted(() => {
  fetchRIS()
  socket.on('risUpdated', handleRISUpdated)
  socket.on('risIssued', handleRISUpdated)

  const user = localStorage.getItem('user')
  if (user) socket.emit('authenticate', JSON.parse(user)._id)
})

onUnmounted(() => {
  socket.off('risUpdated', handleRISUpdated)
  socket.off('risIssued', handleRISUpdated)
})

// Download RIS Excel
async function downloadExcel() {
  console.log(ris.value)
  if (!ris.value) return
  downloading.value = true
  error.value = null
  successMessage.value = null

  try {
    const id = String(route.params.id)
    const response = await axios.get(`/ris/${id}/export`, {
      responseType: 'blob'
    })

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)

    // Try to extract filename from Content-Disposition
    const disposition = response.headers?.['content-disposition'] || ''
    let filename = `RIS-${ris.value.risNumber || id}.xlsx`
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition)
    if (match) {
      filename = decodeURIComponent(match[1] || match[2])
    }

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)

    successMessage.value = 'RIS Excel downloaded successfully'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to download RIS Excel'
  } finally {
    downloading.value = false
  }
}

// Print RIS
function printRIS() {
  if (!ris.value) return

  const remainingFor = (item) => {
    const id = typeof item.product === 'string' ? item.product : item.product._id
    return (item.requestedQty || 0) - (item.issuedQty || 0)
  }

  const rows = ris.value.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.name || ''}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.sku || ''}</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${
            item.requestedQty || 0
          }</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${
            item.issuedQty || 0
          }</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${remainingFor(
            item
          )}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.remarks || ''}</td>
        </tr>`
    )
    .join('')

  const html = `
    <html>
      <head>
        <title>RIS #${ris.value.risNumber}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111; }
          .header { display:flex; justify-content:space-between; align-items:center; }
          .title { font-size: 20px; font-weight: 600; }
          .meta { margin-top: 6px; font-size: 12px; color: #555; }
          table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          th { background: #f5f5f5; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          .section { margin-top: 12px; }
          .label { font-weight: 600; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Requisition Issue Slip (RIS)</div>
          <div>RIS #${ris.value.risNumber}</div>
        </div>
        <div class="meta">Created: ${formatDate(ris.value.createdAt)} | Status: ${
          ris.value.status
        }</div>
        <div class="section"><span class="label">Purpose:</span> ${ris.value.purpose}</div>
        <div class="section"><span class="label">Requestor:</span> ${ris.value.requestor}</div>
        ${
          ris.value.department
            ? `<div class="section"><span class="label">Department:</span> ${ris.value.department}</div>`
            : ''
        }
        ${
          ris.value.notes
            ? `<div class="section"><span class="label">Notes:</span> ${ris.value.notes}</div>`
            : ''
        }
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Requested</th>
              <th>Issued</th>
              <th>Remaining</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `

  const printWindow = window.open('', '', 'width=900,height=700')
  if (!printWindow) return
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// Extract tokens like SN and ACN from remarks string (e.g., "SN: XXX | ACN: YYY")
function parseRemarksTokens(remarks) {
  if (!remarks) return { sn: '', acn: '' }
  const snMatch = /SN:\s*([^|]+)/i.exec(remarks)
  const acnMatch = /ACN:\s*([^|]+)/i.exec(remarks)
  return {
    sn: snMatch ? snMatch[1].trim() : '',
    acn: acnMatch ? acnMatch[1].trim() : ''
  }
}

// Group deployment items by employee for a cleaner card view
const groupedDeployment = computed(() => {
  const employees = ris.value?.deploymentData?.employees || []
  return employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    items: (emp.items || []).map((it) => {
      const tokens = parseRemarksTokens(it.remarks || '')
      return {
        productName: it.productName || 'Product',
        propertyNumber: it.propertyNumber || '',
        quantity: it.quantity || 1,
        sn: tokens.sn,
        acn: tokens.acn,
        remarks: it.remarks || ''
      }
    })
  }))
})

function percentIssuedForItem(item) {
  const issued = item.issuedQty || 0
  const requested = item.requestedQty || 0
  if (!requested) return 0
  return Math.round((issued / requested) * 100)
}
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <div
        v-if="successMessage"
        class="bg-success bg-opacity-10 border border-success text-success px-4 py-3 rounded mb-4 flex justify-between items-center"
      >
        <span>{{ successMessage }}</span>
        <button @click="successMessage = null" class="text-success hover:text-opacity-80">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div
        v-if="error"
        class="bg-danger bg-opacity-10 border border-danger text-danger px-4 py-3 rounded mb-4 flex justify-between items-center"
      >
        <span>{{ error }}</span>
        <button @click="error = null" class="text-danger hover:text-opacity-80">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div v-if="loading" class="flex justify-center items-center p-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <div
        v-else-if="ris"
        class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-6 mt-4"
      >
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 class="text-2xl font-semibold mb-2">RIS #{{ ris.risNumber }}</h1>
            <div class="flex flex-wrap gap-2 items-center text-sm text-gray-600 dark:text-gray-400">
              <span class="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Created: {{ formatDate(ris.createdAt) }}
              </span>
              <span class="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Requestor: {{ ris.requestor }}
              </span>
              <span v-if="ris.department" class="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Department: {{ ris.department }}
              </span>
            </div>
          </div>

          <div class="mt-4 md:mt-0 flex items-center gap-3">
            <button
              type="button"
              @click="downloadExcel"
              class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 flex items-center"
              :disabled="downloading"
            >
              <svg
                v-if="downloading"
                class="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v10a1 1 0 01-1 1h-3l-2 3-2-3H4a1 1 0 01-1-1V3zm8 7V5H9v5H7l3 3 3-3h-2z"
                />
              </svg>
              {{ downloading ? 'Preparing...' : 'Download RIS' }}
            </button>

            <!-- <button
              type="button"
              @click="
                router.push({ name: 'ris-print', params: { id: ris._id || route.params.id } })
              "
              class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v3h-2V4H6v3H4V4z" />
                <path d="M4 9a2 2 0 00-2 2v3h4v2h8v-2h4v-3a2 2 0 00-2-2H4zm2 3h8v2H6v-2z" />
              </svg>
              Print RIS
            </button> -->

            <span
              :class="['px-3 py-1 rounded-full text-xs font-medium', getStatusClass(ris.status)]"
            >
              {{ ris.status }}
            </span>
          </div>
        </div>

        <!-- RIS Type and Deployment Info -->
        <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 class="text-lg font-semibold mb-2">RIS Type</h3>
            <span
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium',
                ris.risType === 'Deployment'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              ]"
            >
              {{ ris.risType || 'Individual' }}
            </span>
          </div>

          <div v-if="ris.risType === 'Deployment' && ris.deploymentData?.employees?.length">
            <h3 class="text-lg font-semibold mb-2">
              Deployed Employees ({{ ris.deploymentData.employees.length }})
            </h3>
            <div class="bg-gray-50 dark:bg-meta-4 p-3 rounded max-h-32 overflow-y-auto">
              <div
                v-for="employee in ris.deploymentData.employees"
                :key="employee.id"
                class="flex justify-between items-center py-1"
              >
                <span class="font-medium">{{ employee.name }}</span>
                <span class="text-sm text-gray-500">{{ employee.items?.length || 0 }} items</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-lg font-semibold mb-2">Purpose</h3>
          <p class="bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ ris.purpose }}</p>
        </div>

        <div v-if="ris.notes" class="mb-6">
          <h3 class="text-lg font-semibold mb-2">Notes</h3>
          <p class="bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ ris.notes }}</p>
        </div>

        <!-- Approval / Issuance Info -->
        <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
            <div class="text-sm font-semibold mb-1">Approved By</div>
            <div class="text-sm">
              {{
                ris.approvedBy?.firstName
                  ? `${ris.approvedBy.firstName} ${ris.approvedBy.lastName || ''}`
                  : '—'
              }}
            </div>
          </div>
          <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
            <div class="text-sm font-semibold mb-1">Issued By</div>
            <div class="text-sm">
              {{
                ris.issuedBy?.firstName
                  ? `${ris.issuedBy.firstName} ${ris.issuedBy.lastName || ''}`
                  : '—'
              }}
            </div>
          </div>
          <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
            <div class="text-sm font-semibold mb-1">Received By</div>
            <div class="text-sm">{{ ris.requestor }}</div>
          </div>
        </div>

        <!-- Deployment Summary -->
        <div
          v-if="ris.risType === 'Deployment' && ris.deploymentData?.employees?.length"
          class="mb-6"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">Deployment Summary</h3>
            <div
              class="inline-flex rounded border border-stroke dark:border-strokedark overflow-hidden"
            >
              <button
                class="px-3 py-1 text-xs font-medium"
                :class="
                  deploymentView === 'cards'
                    ? 'bg-gray-100 dark:bg-meta-4'
                    : 'bg-white dark:bg-boxdark'
                "
                @click="deploymentView = 'cards'"
              >
                Cards
              </button>
              <button
                class="px-3 py-1 text-xs font-medium border-l border-stroke dark:border-strokedark"
                :class="
                  deploymentView === 'table'
                    ? 'bg-gray-100 dark:bg-meta-4'
                    : 'bg-white dark:bg-boxdark'
                "
                @click="deploymentView = 'table'"
              >
                Table
              </button>
            </div>
          </div>

          <div
            v-if="deploymentView === 'cards'"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div
              v-for="emp in groupedDeployment"
              :key="emp.id"
              class="rounded-sm border border-stroke dark:border-strokedark bg-white dark:bg-boxdark p-4"
            >
              <div class="font-semibold">{{ emp.name }}</div>
              <div class="mt-2 space-y-3">
                <div
                  v-for="it in emp.items"
                  :key="it.productName + (it.sn || '') + (it.acn || '') + (it.propertyNumber || '')"
                  class="flex items-start justify-between"
                >
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{{ it.productName }}</div>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span
                        v-if="it.propertyNumber"
                        class="inline-flex items-center px-2 py-0.5 rounded bg-bodydark/10 text-xs text-bodydark dark:bg-meta-4"
                        >Prop#: {{ it.propertyNumber }}</span
                      >
                      <span
                        v-if="it.sn"
                        class="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary text-xs"
                        >SN: {{ it.sn }}</span
                      >
                      <span
                        v-if="it.acn"
                        class="inline-flex items-center px-2 py-0.5 rounded bg-success/10 text-success text-xs"
                        >ACN: {{ it.acn }}</span
                      >
                    </div>
                  </div>
                  <div class="text-xs text-gray-500">×{{ it.quantity }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full bg-white dark:bg-boxdark rounded-sm">
              <thead>
                <tr class="text-left bg-gray-50 dark:bg-meta-4">
                  <th class="p-4 border-b border-stroke">Employee</th>
                  <th class="p-4 border-b border-stroke">Product</th>
                  <th class="p-4 border-b border-stroke">Property Number</th>
                  <th class="p-4 border-b border-stroke">Quantity</th>
                  <th class="p-4 border-b border-stroke">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <template>
                  <div v-for="employee in ris.deploymentData.employees" :key="employee.id">
                    <tr
                      v-for="item in employee.items"
                      :key="`${employee.id}-${item.product}`"
                      class="border-b border-stroke last:border-0"
                    >
                      <td class="p-4">{{ employee.name }}</td>
                      <td class="p-4">{{ item.productName || 'Product' }}</td>
                      <td class="p-4">{{ item.propertyNumber || '—' }}</td>
                      <td class="p-4">{{ item.quantity || 1 }}</td>
                      <td class="p-4">{{ item.remarks || '—' }}</td>
                    </tr>
                  </div>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">
              {{ ris.risType === 'Deployment' ? 'Summary Items' : 'Items' }}
            </h3>
            <div
              class="inline-flex rounded border border-stroke dark:border-strokedark overflow-hidden"
            >
              <button
                class="px-3 py-1 text-xs font-medium"
                :class="
                  summaryView === 'cards'
                    ? 'bg-gray-100 dark:bg-meta-4'
                    : 'bg-white dark:bg-boxdark'
                "
                @click="summaryView = 'cards'"
              >
                Cards
              </button>
              <button
                class="px-3 py-1 text-xs font-medium border-l border-stroke dark:border-strokedark"
                :class="
                  summaryView === 'table'
                    ? 'bg-gray-100 dark:bg-meta-4'
                    : 'bg-white dark:bg-boxdark'
                "
                @click="summaryView = 'table'"
              >
                Table
              </button>
            </div>
          </div>

          <!-- Card Grid View -->
          <div
            v-if="summaryView === 'cards'"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div
              v-for="item in ris.items"
              :key="item.product"
              class="rounded-sm border border-stroke dark:border-strokedark bg-white dark:bg-boxdark p-4"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-medium">{{ item.name }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">SKU: {{ item.sku }}</div>
                </div>
                <div class="text-xs px-2 py-1 rounded bg-bodydark/10 dark:bg-meta-4">
                  Qty {{ item.requestedQty }}
                </div>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-xs text-bodydark2">Requested</div>
                  <div class="text-lg font-semibold">{{ item.requestedQty }}</div>
                </div>
                <div>
                  <div class="text-xs text-bodydark2">Issued</div>
                  <div class="text-lg font-semibold">{{ item.issuedQty }}</div>
                </div>
                <div>
                  <div class="text-xs text-bodydark2">Remaining</div>
                  <div class="text-lg font-semibold">
                    {{
                      remainingQty[
                        typeof item.product === 'string' ? item.product : item.product._id
                      ] || 0
                    }}
                  </div>
                </div>
              </div>
              <div class="mt-2 h-2 rounded bg-gray-200 dark:bg-meta-4">
                <div
                  class="h-2 rounded bg-primary"
                  :style="{ width: percentIssuedForItem(item) + '%' }"
                ></div>
              </div>

              <!-- Issuance controls -->
              <div v-if="ris.status === 'requested'" class="mt-3">
                <label class="mb-1 block text-xs text-black dark:text-white">Issue Now</label>
                <input
                  type="number"
                  min="0"
                  :max="
                    remainingQty[
                      typeof item.product === 'string' ? item.product : item.product._id
                    ] || 0
                  "
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  v-model.number="
                    issueQuantities[
                      typeof item.product === 'string' ? item.product : item.product._id
                    ]
                  "
                  :disabled="isFullyIssued || item.issuedQty >= item.requestedQty"
                />

                <!-- Serial numbers selection when required -->
                <div v-if="item.hasSerialNumbers" class="mt-2">
                  <label class="mb-1 block text-xs text-black dark:text-white"
                    >Serial Numbers</label
                  >
                  <SerialPicker
                    v-model="
                      selectedSerials[
                        typeof item.product === 'string' ? item.product : item.product._id
                      ]
                    "
                    :serials="
                      productSerials[
                        typeof item.product === 'string' ? item.product : item.product._id
                      ] || []
                    "
                    :limit="
                      issueQuantities[
                        typeof item.product === 'string' ? item.product : item.product._id
                      ] || 0
                    "
                  />
                </div>
                <div v-if="item.remarks" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Remarks: {{ item.remarks }}
                </div>
              </div>
            </div>
          </div>

          <!-- Table View (original) -->
          <div v-else class="overflow-x-auto">
            <table class="w-full bg-white dark:bg-boxdark rounded-sm">
              <thead>
                <tr class="text-left bg-gray-50 dark:bg-meta-4">
                  <th class="p-4 border-b border-stroke">Item</th>
                  <th class="p-4 border-b border-stroke">Requested</th>
                  <th class="p-4 border-b border-stroke">Issued</th>
                  <th class="p-4 border-b border-stroke">Remaining</th>
                  <th class="p-4 border-b border-stroke" v-if="ris.status === 'requested'">
                    Issue Now
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in ris.items"
                  :key="item.product"
                  class="border-b border-stroke last:border-0"
                >
                  <td class="p-4">
                    <div class="font-medium">{{ item.name }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">SKU: {{ item.sku }}</div>
                  </td>
                  <td class="p-4">{{ item.requestedQty }}</td>
                  <td class="p-4">{{ item.issuedQty }}</td>
                  <td class="p-4">
                    {{
                      remainingQty[
                        typeof item.product === 'string' ? item.product : item.product._id
                      ] || 0
                    }}
                  </td>
                  <td class="p-4" v-if="ris.status === 'requested'">
                    <input
                      type="number"
                      min="0"
                      :max="
                        remainingQty[
                          typeof item.product === 'string' ? item.product : item.product._id
                        ] || 0
                      "
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      v-model.number="
                        issueQuantities[
                          typeof item.product === 'string' ? item.product : item.product._id
                        ]
                      "
                      :disabled="isFullyIssued || item.issuedQty >= item.requestedQty"
                    />
                    <!-- Serial numbers selection when required -->
                    <div v-if="item.hasSerialNumbers" class="mt-2">
                      <label class="mb-1 block text-xs text-black dark:text-white"
                        >Serial Numbers</label
                      >
                      <SerialPicker
                        v-model="
                          selectedSerials[
                            typeof item.product === 'string' ? item.product : item.product._id
                          ]
                        "
                        :serials="
                          productSerials[
                            typeof item.product === 'string' ? item.product : item.product._id
                          ] || []
                        "
                        :limit="
                          issueQuantities[
                            typeof item.product === 'string' ? item.product : item.product._id
                          ] || 0
                        "
                      />
                    </div>
                    <div v-if="item.remarks" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Remarks: {{ item.remarks }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex justify-between items-center">
          <button
            type="button"
            @click="router.push('/inventory/ris')"
            class="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
          >
            Back to List
          </button>

          <button
            v-if="ris.status === 'requested' && !ris.approvedBy"
            type="button"
            @click="approve"
            class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-opacity-90 mr-3"
            :disabled="issuing"
          >
            Approve
          </button>

          <button
            v-if="ris.status === 'requested' && !isFullyIssued"
            type="button"
            @click="issue"
            class="bg-primary text-white px-6 py-2 rounded hover:bg-opacity-90 flex items-center"
            :disabled="issuing"
          >
            <svg
              v-if="issuing"
              class="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {{ issuing ? 'Issuing...' : 'Issue Items' }}
          </button>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
