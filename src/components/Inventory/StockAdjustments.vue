<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import StockAdjustmentForm from './StockAdjustmentForm.vue' // Import your existing form component
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'

const authStore = useAuthStore()
const adjustments = ref([])
const products = ref([])
const isLoading = ref(false)
const showAdjustmentModal = ref(false) // Renamed from showCreateModal
const showDetailsModal = ref(false)
const selectedAdjustment = ref(null)
const searchQuery = ref('')
const adjustmentTypeFilter = ref('all')

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10) // Or any default value you prefer

// Fetch all stock adjustments
const fetchAdjustments = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('https://ims-api-id38.onrender.com/api/inventory/adjustments', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    adjustments.value = response.data.adjustments
  } catch (error) {
    console.error('Error fetching stock adjustments:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch stock adjustments'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch products
const fetchProducts = async () => {
  try {
    const response = await axios.get('https://ims-api-id38.onrender.com/api/products', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
  }
}

// Handle adjustment created event
const handleAdjustmentCreated = async () => {
  showAdjustmentModal.value = false
  await fetchAdjustments()
}

// View adjustment details
const viewAdjustmentDetails = async (adjustmentId) => {
  try {
    isLoading.value = true
    const response = await axios.get(
      `https://ims-api-id38.onrender.com/api/inventory/adjustments/${adjustmentId}`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )
    selectedAdjustment.value = response.data.adjustment
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching adjustment details:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch adjustment details'
    })
  } finally {
    isLoading.value = false
  }
}

// Filter adjustments by type and search query
const filteredAdjustments = computed(() => {
  let filtered = adjustments.value || []

  // Filter by adjustment type
  if (adjustmentTypeFilter.value !== 'all') {
    filtered = filtered.filter((adj) => adj.adjustmentType === adjustmentTypeFilter.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (adj) =>
        adj.product.name.toLowerCase().includes(query) ||
        adj.product.sku.toLowerCase().includes(query) ||
        adj.reason.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Pagination computed properties
const totalPages = computed(() => Math.ceil(filteredAdjustments.value.length / itemsPerPage.value))

const paginatedAdjustments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredAdjustments.value.slice(start, end)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}


// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
// Format currency for PDF
const formatCurrencyForPDF = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

// Export inventory adjustments to PDF
const exportAdjustmentsPDF = async () => {
  try {
    // Create a new PDF document
    const doc = new jsPDF()
    
    // Set margins
    const marginLeft = 15
    const marginRight = 15
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - marginLeft - marginRight
    const lineHeight = 7
    let currentY = 20

    // Add header with title
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Stock Adjustments Report', pageWidth / 2, currentY, { align: 'center' })
    currentY += 12

    // Add a horizontal line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY)
    currentY += 8

    // Generated On
    const now = new Date()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated on: ${format(now, 'MMM dd, yyyy h:mm a')}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 15

    // Adjustment Types Statistics in a box
    doc.setDrawColor(240, 240, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(marginLeft, currentY, contentWidth, 60, 2, 2, 'FD')
    
    currentY += 8
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Adjustment Types Overview', marginLeft + 10, currentY)
    currentY += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    // Get adjustment type counts
    const adjustmentTypes = getAdjustmentTypeCounts()
    
    // Display adjustment type statistics
    Object.entries(adjustmentTypes).forEach(([type, count], index) => {
      if (index % 2 === 0) {
        // Start a new row every 2 items
        if (index > 0) currentY += lineHeight
      }
      
      const colWidth = contentWidth / 2
      const colPosition = index % 2 === 0 ? marginLeft + 10 : marginLeft + 10 + colWidth
      
      doc.text(`${getAdjustmentTypeName(type)}: ${count}`, colPosition, currentY)
    })
    
    currentY += 15

    // Stock Adjustments Table
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Stock Adjustments', marginLeft, currentY)
    currentY += 8

    // Table headers with background
    const headers = ['Product', 'Type', 'Previous Qty', 'New Qty', 'Change', 'Reason', 'Date']
    const colWidths = [40, 25, 25, 25, 20, 30, 25]
    
    // Calculate positions for columns
    const positions = []
    let currentX = marginLeft
    for (let i = 0; i < colWidths.length; i++) {
      positions.push(currentX)
      currentX += colWidths[i]
    }
    
    // Draw header background
    doc.setFillColor(240, 240, 240)
    doc.rect(marginLeft, currentY, contentWidth, lineHeight, 'F')
    
    // Draw header text
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], positions[i] + 2, currentY + 5)
    }
    
    currentY += lineHeight + 2

    // Table rows
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    
    // Track items per page for pagination
    const itemsPerPage = 20
    let itemsOnCurrentPage = 0
    let totalPages = Math.ceil(filteredAdjustments.value.length / itemsPerPage)
    let currentPage = 1
    
    // Function to add header to new pages
    const addTableHeader = () => {
      currentY = 20
      
      // Add page header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Stock Adjustments Report - Continued', pageWidth / 2, currentY, { align: 'center' })
      currentY += 10
      
      // Draw header background
      doc.setFillColor(240, 240, 240)
      doc.rect(marginLeft, currentY, contentWidth, lineHeight, 'F')
      
      // Draw header text
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], positions[i] + 2, currentY + 5)
      }
      
      currentY += lineHeight + 2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }

    // Draw alternating row backgrounds and data
    filteredAdjustments.value.forEach((adjustment, index) => {
      // Check if we need a new page
      if (itemsOnCurrentPage >= itemsPerPage) {
        doc.addPage()
        currentPage++
        itemsOnCurrentPage = 0
        addTableHeader()
      }
      
      // Draw row background (alternating)
      if (index % 2 === 1) {
        doc.setFillColor(248, 248, 248)
        doc.rect(marginLeft, currentY - 1, contentWidth, lineHeight, 'F')
      }
      
      // Calculate change
      const change = adjustment.newQuantity - adjustment.previousQuantity
      const changeText = change >= 0 ? `+${change}` : `${change}`
      
      // Format data
      const productName = adjustment.product?.name || 'Unknown'
      const truncatedName = productName.length > 15 ? productName.substring(0, 15) + '...' : productName
      
      const rowData = [
        truncatedName,
        getAdjustmentTypeName(adjustment.adjustmentType),
        adjustment.previousQuantity.toString(),
        adjustment.newQuantity.toString(),
        changeText,
        adjustment.reason.length > 10 ? adjustment.reason.substring(0, 10) + '...' : adjustment.reason,
        formatDate(adjustment.createdAt)
      ]
      
      // Draw row data
      for (let i = 0; i < rowData.length; i++) {
        doc.text(rowData[i], positions[i] + 2, currentY + 4)
      }
      
      currentY += lineHeight
      itemsOnCurrentPage++
    })

    // Footer with pagination on all pages
    for (let i = 1; i <= currentPage; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      doc.text(`Page ${i} of ${currentPage}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' })
    }

    doc.save(`Stock_Adjustments_Report_${format(now, 'yyyy-MM-dd')}.pdf`)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Stock adjustments report exported successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })

  } catch (error) {
    console.error('Error exporting stock adjustments to PDF:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to export stock adjustments report'
    })
  }
}

// Helper function to get adjustment type counts
const getAdjustmentTypeCounts = () => {
  const counts = {
    addition: 0,
    reduction: 0,
    damage: 0,
    loss: 0,
    count: 0,
    return: 0
  }
  
  filteredAdjustments.value.forEach(adjustment => {
    if (counts[adjustment.adjustmentType] !== undefined) {
      counts[adjustment.adjustmentType]++
    }
  })
  
  return counts
}

// Get adjustment type badge class
const getAdjustmentTypeClass = (type) => {
  switch (type) {
    case 'receive':
      return 'bg-success text-white'
    case 'reduction':
      return 'bg-warning text-white'
    case 'damage':
      return 'bg-danger text-white'
    case 'loss':
      return 'bg-danger text-white'
    case 'count':
      return 'bg-sky-500 text-white'
    case 'return':
      return 'bg-primary text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

// Get formatted adjustment type name
const getAdjustmentTypeName = (type) => {
  switch (type) {
    case 'receive':
      return 'receive'
    case 'reduction':
      return 'Reduction'
    case 'damage':
      return 'Damage'
    case 'loss':
      return 'Loss'
    case 'count':
      return 'Count'
    case 'return':
      return 'Return'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

onMounted(async () => {
  await Promise.all([fetchAdjustments(), fetchProducts()])
  // Reset to page 1 when filters change or data is re-fetched
  // This might be better placed inside fetchAdjustments or when filters change
  // For now, let's ensure it's reset on mount if data is fetched.
  currentPage.value = 1
})

// Watch for filter changes to reset pagination
watch([searchQuery, adjustmentTypeFilter], () => {
  currentPage.value = 1
})
</script>

<template>
  <div>
    <!-- Root element wrapper -->
    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <!-- Header -->
      <div class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h3 class="text-xl font-semibold text-black dark:text-white">Stock Adjustments</h3>
          <div class="flex items-center gap-3">
            <button
    @click="exportAdjustmentsPDF"
    class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
  >
    <svg
      class="mr-2 h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      ></path>
    </svg>
    Export PDF
  </button>
            <button
              @click="showAdjustmentModal = true"
              class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-white hover:bg-opacity-90"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </svg>
              New Adjustment
            </button>
          </div>
        </div>
      </div>

      <!-- Filter and Search -->
      <div class="p-4 border-b border-stroke dark:border-strokedark">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex-1">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search by product, SKU, or reason..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-4 pr-4 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
          <div>
            <select
              v-model="adjustmentTypeFilter"
              class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-strokedark"
            >
              <option value="all">All Types</option>
              <option value="receive">Receive</option>
              <option value="reduction">Reduction</option>
              <option value="damage">Damage</option>
              <option value="loss">Loss</option>
              <option value="count">Count</option>
              <option value="return">Return</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Adjustments Table -->
      <div class="p-4">
        <div v-if="isLoading" class="flex justify-center items-center py-10">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="filteredAdjustments.length === 0" class="text-center py-10">
          <p class="text-lg text-gray-500 dark:text-gray-400">No stock adjustments found</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-4 px-4 font-medium text-black dark:text-white">Product</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Type</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Previous Qty</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">New Qty</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Change</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Reason</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Date</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="adjustment in paginatedAdjustments"
                :key="adjustment._id"
                class="border-b border-stroke dark:border-strokedark"
              >
                <td class="py-3 px-4">
                  {{ adjustment.product.name }}
                  <div class="text-xs text-gray-500">{{ adjustment.product.sku }}</div>
                </td>
                <td class="py-3 px-4">
                  <span
                    :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdjustmentTypeClass(
                      adjustment.adjustmentType
                    )}`"
                  >
                    {{ getAdjustmentTypeName(adjustment.adjustmentType) }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ adjustment.previousQuantity }}</td>
                <td class="py-3 px-4">{{ adjustment.newQuantity }}</td>
                <td class="py-3 px-4">
                  <span
                    :class="`${adjustment.adjustmentQuantity > 0 ? 'text-success' : 'text-danger'}`"
                  >
                    {{ adjustment.adjustmentQuantity > 0 ? '+' : ''
                    }}{{ adjustment.adjustmentQuantity }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ adjustment.reason }}</td>
                <td class="py-3 px-4">{{ formatDate(adjustment.createdAt) }}</td>
                <td class="py-3 px-4">
                  <button
                    @click="viewAdjustmentDetails(adjustment._id)"
                    class="hover:text-primary"
                    title="View Details"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path
                        fill-rule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="flex items-center justify-between p-4">
          <div class="flex items-center gap-2">
            <select
              v-model="itemsPerPage"
              class="rounded border border-stroke bg-transparent px-2 py-1"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
            <span>Items per page</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="rounded px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="rounded px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Use your existing StockAdjustmentForm component for multiple product adjustments -->
    <StockAdjustmentForm
      :modalVisible="showAdjustmentModal"
      @close="showAdjustmentModal = false"
      @adjustment-created="handleAdjustmentCreated"
    />

    <!-- Adjustment Details Modal -->
    <div
      v-if="showDetailsModal && selectedAdjustment"
      class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div
        class="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
      >
        <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-black dark:text-white">Adjustment Details</h3>
            <button @click="showDetailsModal = false" class="text-gray-500 hover:text-red-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-6.5">
          <div class="grid grid-cols-2 gap-6 mb-6">
            <div class="col-span-1">
              <h4 class="text-lg font-semibold mb-3">Adjustment Information</h4>
              <div class="space-y-2">
                <p>
                  <span class="font-medium">Product:</span>
                  {{ selectedAdjustment.product.name }} ({{ selectedAdjustment.product.sku }})
                </p>
                <p>
                  <span class="font-medium">Type:</span>
                  <span
                    :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdjustmentTypeClass(
                      selectedAdjustment.adjustmentType
                    )}`"
                  >
                    {{ getAdjustmentTypeName(selectedAdjustment.adjustmentType) }}
                  </span>
                </p>
                <p>
                  <span class="font-medium">Previous Quantity:</span>
                  {{ selectedAdjustment.previousQuantity }}
                </p>
                <p>
                  <span class="font-medium">New Quantity:</span>
                  {{ selectedAdjustment.newQuantity }}
                </p>
                <p>
                  <span class="font-medium">Change:</span>
                  <span
                    :class="`${
                      selectedAdjustment.adjustmentQuantity > 0 ? 'text-success' : 'text-danger'
                    }`"
                  >
                    {{ selectedAdjustment.adjustmentQuantity > 0 ? '+' : ''
                    }}{{ selectedAdjustment.adjustmentQuantity }}
                  </span>
                </p>
                <p>
                  <span class="font-medium">Reason:</span>
                  {{ selectedAdjustment.reason }}
                </p>
                <p v-if="selectedAdjustment.reference">
                  <span class="font-medium">Reference:</span>
                  {{ selectedAdjustment.reference }}
                </p>
                <p>
                  <span class="font-medium">Created:</span>
                  {{ formatDate(selectedAdjustment.createdAt) }}
                </p>
                <p>
                  <span class="font-medium">Created By:</span>
                  {{ selectedAdjustment.createdBy?.user.firstName || 'Unknown' }}
                  {{ selectedAdjustment.createdBy?.user.lastName || '' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- End of root element wrapper -->
</template>
