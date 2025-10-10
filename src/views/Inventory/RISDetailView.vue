<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../../utils/axios'
import { socket } from '../../socket'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'

const route = useRoute()
const router = useRouter()

const pageTitle = ref('Requisition Issue Slip Details')
const ris = ref(null)
const loading = ref(true)
const error = ref(null)
const issuing = ref(false)
const successMessage = ref(null)
const downloading = ref(false)

// key: productId (string), value: quantity to issue
const issueQuantities = ref({})

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
    const { data } = await axios.post(`/ris/${ris.value._id}/issue`, { issueQuantities: payload })
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
    return (
      (item.requestedQty || 0) - (item.issuedQty || 0)
    )
  }

  const rows = ris.value.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.name || ''}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.sku || ''}</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${item.requestedQty || 0}</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${item.issuedQty || 0}</td>
          <td style="padding:8px;border:1px solid #ddd; text-align:right;">${remainingFor(item)}</td>
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
        <div class="meta">Created: ${formatDate(ris.value.createdAt)} | Status: ${ris.value.status}</div>
        <div class="section"><span class="label">Purpose:</span> ${ris.value.purpose}</div>
        <div class="section"><span class="label">Requestor:</span> ${ris.value.requestor}</div>
        ${ris.value.department ? `<div class="section"><span class="label">Department:</span> ${ris.value.department}</div>` : ''}
        ${ris.value.notes ? `<div class="section"><span class="label">Notes:</span> ${ris.value.notes}</div>` : ''}
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

            <button
              type="button"
              @click="router.push({ name: 'ris-print', params: { id: ris._id || route.params.id } })"
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
            </button>

            <span
              :class="['px-3 py-1 rounded-full text-xs font-medium', getStatusClass(ris.status)]"
            >
              {{ ris.status }}
            </span>
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

        <div class="mb-6">
          <h3 class="text-lg font-semibold mb-4">Items</h3>
          <div class="overflow-x-auto">
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
