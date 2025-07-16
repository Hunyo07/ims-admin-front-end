<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores'
import Swal from 'sweetalert2'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

const authStore = useAuthStore()
const inventoryCounts = ref([]) // Ensure this is correctly populated
const products = ref([])
const isLoading = ref(false)
const showCreateModal = ref(false)
const showDetailsModal = ref(false)
const selectedCount = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Format currency for PDF
const formatCurrencyForPDF = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

const exportInventoryCountsPDF = async () => {
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
    doc.text('Inventory Counts Report', pageWidth / 2, currentY, { align: 'center' })
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

    // Inventory Counts Statistics in a box
    doc.setDrawColor(240, 240, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(marginLeft, currentY, contentWidth, 30, 2, 2, 'FD')
    
    currentY += 8
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Inventory Counts Overview', marginLeft + 10, currentY)
    currentY += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    // Create a 2x1 grid for statistics
    const colWidth = contentWidth / 2
    
    // Statistics row
    doc.text(`Total Counts: ${inventoryCounts.value.length}`, marginLeft + 10, currentY)
    doc.text(`Total Products Counted: ${getTotalProductsCounted()}`, marginLeft + 10 + colWidth, currentY)
    
    currentY += 15

    // Inventory Counts Table
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Inventory Counts', marginLeft, currentY)
    currentY += 8

    // Table headers with background
    const headers = ['Count #', 'Date', 'Items Count', 'Created By']
    const colWidths = [30, 40, 40, 60]
    
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
    let totalPages = Math.ceil(filteredInventoryCounts.value.length / itemsPerPage)
    let currentPage = 1
    
    // Function to add header to new pages
    const addTableHeader = () => {
      currentY = 20
      
      // Add page header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Inventory Counts Report - Continued', pageWidth / 2, currentY, { align: 'center' })
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
    filteredInventoryCounts.value.forEach((count, index) => {
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
      
      // Format data
      const rowData = [
        count.countNumber,
        formatDate(count.countDate),
        Array.isArray(count.products) ? count.products.length.toString() : '0',
        count.createdBy?.user.firstName || 'Unknown'
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

    doc.save(`Inventory_Counts_Report_${format(now, 'yyyy-MM-dd')}.pdf`)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Inventory counts report exported successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })

  } catch (error) {
    console.error('Error exporting inventory counts to PDF:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to export inventory counts report'
    })
  }
}

// Add exportInventoryCountDetailsPDF function
const exportInventoryCountDetailsPDF = () => {
  if (!selectedCount.value) return;
  const count = selectedCount.value.inventoryCount;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 20;
  const marginRight = 20;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 20;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Inventory Count Details', pageWidth / 2, currentY, { align: 'center' });
  currentY += 12;

  // Line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY);
  currentY += 8;

  // Count Info Box
  doc.setDrawColor(240, 240, 240);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(marginLeft, currentY, contentWidth, 32, 2, 2, 'FD');
  let infoY = currentY + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Count Information', marginLeft + 5, infoY);
  infoY += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Count Number: ${count.countNumber}`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Count Date: ${formatDate(count.countDate)}`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Created: ${formatDate(count.createdAt)}`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Created By: ${count.createdBy?.user.firstName || 'Unknown'}`, marginLeft + 5, infoY);
  currentY += 36;

  // Items Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Count Items', marginLeft, currentY);
  currentY += 8;
  autoTable(doc, {
    startY: currentY,
    head: [['Product Name', 'SKU', 'Expected Qty', 'Notes']],
    body: count.products.map(item => [
      item.product.name,
      item.product.sku,
      String(item.expectedQuantity),
      item.notes || '-'
    ]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 50 }
    },
    margin: { left: marginLeft, right: marginRight }
  });
  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 40;

  // Notes
  if (selectedCount.value.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', marginLeft, currentY);
    currentY += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(240, 240, 240);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, 'FD');
    const splitNotes = doc.splitTextToSize(selectedCount.value.notes, contentWidth - 10);
    doc.text(splitNotes, marginLeft + 5, currentY + 5);
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Created by: ${count.createdBy?.user.firstName || 'Unknown'} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`Inventory_Count_Details_${count.countNumber}.pdf`);
};

// Helper function to get total products counted
const getTotalProductsCounted = () => {
  return inventoryCounts.value.reduce((total, count) => {
    return total + (Array.isArray(count.products) ? count.products.length : 0)
  }, 0)
}

const newCount = ref({
  items: [{ productId: '', expectedQuantity: 0, actualQuantity: 0, notes: '' }],
  countDate: new Date(),
  notes: ''
})

const totalPages = computed(() =>
  Math.ceil(filteredInventoryCounts.value.length / itemsPerPage.value)
)

const paginatedCounts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredInventoryCounts.value.slice(start, end)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

// Fetch all inventory counts
const fetchInventoryCounts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('https://ims-api-id38.onrender.com/api/inventory/counts', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    inventoryCounts.value = response.data.inventoryCounts // Ensure correct data path
  } catch (error) {
    console.error('Error fetching inventory counts:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch inventory counts'
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

// Add item to inventory count
const addItem = () => {
  newCount.value.items.push({ productId: '', expectedQuantity: 0, actualQuantity: 0, notes: '' })
}

// Remove item from inventory count
const removeItem = (index) => {
  newCount.value.items.splice(index, 1)
}

// Set expected quantity when product is selected
const setExpectedQuantity = async (index) => {
  const productId = newCount.value.items[index].productId
  if (productId) {
    try {
      const response = await axios.get(`https://ims-api-id38.onrender.com/api/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Ensure the response contains the expected quantity
      newCount.value.items[index].expectedQuantity = response.data.product.currentStock || 0
    } catch (error) {
      console.error('Error fetching product inventory:', error)
    }
  }
}

// Calculate variance
const calculateVariance = (expectedQty, actualQty) => {
  return actualQty - expectedQty
}

// Create a new inventory count
const createInventoryCount = async () => {
  try {
    // Check if items array is empty or contains invalid items
    if (
      !newCount.value.items || // Ensure items is defined
      newCount.value.items.length === 0 ||
      newCount.value.items.some((item) => !item.productId || item.actualQuantity < 0)
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Items',
        text: 'Please ensure all items have a product selected and valid quantities'
      })
      return
    }

    isLoading.value = true

    // Prepare the payload
    const payload = {
      products: newCount.value.items.map((item) => ({
        productId: item.productId,
        expectedQuantity: item.expectedQuantity,
        actualQuantity: item.actualQuantity,
        notes: item.notes
      })),
      notes: newCount.value.notes
    }

    // Create the inventory count
    const response = await axios.post('https://ims-api-id38.onrender.com/api/inventory/counts', payload, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    // Get the created count ID
    const countId = response.data.inventoryCount._id

    // Update product counts
    await axios.patch(
      `https://ims-api-id38.onrender.com/api/inventory/counts/${countId}/products`,
      {
        products: newCount.value.items.map((item) => ({
          productId: item.productId,
          actualQuantity: item.actualQuantity,
          notes: item.notes
        }))
      },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Update status to completed
    await axios.patch(
      `https://ims-api-id38.onrender.com/api/inventory/counts/${countId}/status`,
      {
        status: 'completed'
      },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Apply the inventory count to update stock levels
    await axios.post(
      `https://ims-api-id38.onrender.com/api/inventory/counts/${countId}/apply`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Show success message
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Inventory count created and stock levels updated successfully'
    })

    // Reset form and close modal
    resetForm()
    showCreateModal.value = false

    // Refresh inventory counts list
    await fetchInventoryCounts()
  } catch (error) {
    console.error('Error creating and applying inventory count:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to create and apply inventory count'
    })
  } finally {
    isLoading.value = false
  }
}

// Reset the form
const resetForm = () => {
  newCount.value = {
    items: [{ productId: '', expectedQuantity: 0, actualQuantity: 0, notes: '' }],
    countDate: new Date(),
    notes: ''
  }
}

// View inventory count details
const viewCountDetails = async (countId) => {
  if (!countId) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Invalid inventory count ID'
    })
    return
  }
  try {
    isLoading.value = true
    const response = await axios.get(`https://ims-api-id38.onrender.com/api/inventory/counts/${countId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    selectedCount.value = response.data
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching inventory count details:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch inventory count details'
    })
  } finally {
    isLoading.value = false
  }
}

// Filter inventory counts by search query
// const filteredInventoryCounts = computed(() => {
//   let filtered = inventoryCounts.value

//   if (searchQuery.value) {
//     const query = searchQuery.value.toLowerCase()
//     filtered = filtered.filter(
//       (count) =>
//         count.countNumber.toLowerCase().includes(query) ||
//         (Array.isArray(count.items) &&
//           count.items.some((item) => item.product?.name?.toLowerCase().includes(query)))
//     )
//   }

//   return filtered
// })
const filteredInventoryCounts = computed(() => {
  let filtered = inventoryCounts.value || []

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (count) =>
        count.countNumber.toLowerCase().includes(query) ||
        (Array.isArray(count.products) &&
          count.products.some((item) => item.product?.name?.toLowerCase().includes(query)))
    )
  }

  return filtered
})

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(async () => {
  await Promise.all([fetchInventoryCounts(), fetchProducts()])
})
</script>

<template>
  <div>
    <!-- Main Inventory Counts Card -->
    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <!-- Header -->
      <div class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h3 class="text-xl font-semibold text-black dark:text-white">Inventory Counts</h3>
          <div class="flex items-center gap-3">
            <button
              v-if="authStore.hasRole(['admin', 'superadmin'])"
              @click="exportInventoryCountsPDF"
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
              @click="showCreateModal = true"
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
              New Inventory Count
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
              placeholder="Search by count number or product..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-4 pr-4 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
        </div>
      </div>

      <!-- Inventory Counts Table -->
      <div class="p-4">
        <div v-if="isLoading" class="flex justify-center items-center py-10">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="filteredInventoryCounts.length === 0" class="text-center py-10">
          <p class="text-lg text-gray-500 dark:text-gray-400">No inventory counts found</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-4 px-4 font-medium text-black dark:text-white">Count #</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Date</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Items Count</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Created By</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="count in paginatedCounts"
                :key="count._id"
                class="border-b border-stroke dark:border-strokedark"
              >
                <td class="py-3 px-4">{{ count.countNumber }}</td>
                <td class="py-3 px-4">{{ formatDate(count.countDate) }}</td>
                <td class="py-3 px-4">
                  <span v-if="Array.isArray(count.products)">
                    {{ count.products.length }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ count.createdBy?.user.firstName || 'Unknown' }}</td>
                <td class="py-3 px-4">
                  <button
                    @click="viewCountDetails(count._id)"
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
    </div>

    <!-- Create Inventory Count Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div
        class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
      >
        <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-black dark:text-white">New Inventory Count</h3>
            <button @click="showCreateModal = false" class="text-gray-500 hover:text-red-500">
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
          <div class="mb-4.5">
            <label class="mb-2.5 block text-black dark:text-white">Count Date</label>
            <Datepicker
              v-model="newCount.countDate"
              class="w-full"
              :enable-time-picker="false"
              :max-date="new Date()"
              placeholder="Select count date"
            />
          </div>

          <div class="mb-4.5">
            <label class="mb-2.5 block text-black dark:text-white">Notes</label>
            <textarea
              v-model="newCount.notes"
              rows="3"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              placeholder="Add notes about this count"
            ></textarea>
          </div>

          <div class="mb-4.5">
            <div class="flex items-center justify-between mb-2.5">
              <label class="block text-black dark:text-white">
                Count Items <span class="text-meta-1">*</span>
              </label>
              <button
                @click="addItem"
                class="inline-flex items-center justify-center rounded-md bg-primary py-1 px-3 text-white hover:bg-opacity-90"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                Add Item
              </button>
            </div>

            <div
              v-for="(item, index) in newCount.items"
              :key="index"
              class="mb-3 p-3 border border-stroke rounded-md dark:border-strokedark"
            >
              <div class="grid grid-cols-12 gap-3">
                <div class="col-span-4">
                  <label class="mb-1 block text-sm text-black dark:text-white">
                    Product <span class="text-meta-1">*</span>
                  </label>
                  <select
                    v-model="item.productId"
                    @change="setExpectedQuantity(index)"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  >
                    <option value="" disabled>Select Product</option>
                    <option v-for="product in products" :key="product._id" :value="product._id">
                      {{ product.name }} ({{ product.sku }})
                    </option>
                  </select>
                </div>

                <div class="col-span-2">
                  <label class="mb-1 block text-sm text-black dark:text-white">Expected Qty</label>
                  <input
                    type="number"
                    v-model.number="item.expectedQuantity"
                    readonly
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  />
                </div>

                <div class="col-span-2">
                  <label class="mb-1 block text-sm text-black dark:text-white">
                    Actual Qty <span class="text-meta-1">*</span>
                  </label>
                  <input
                    type="number"
                    v-model.number="item.actualQuantity"
                    min="0"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  />
                </div>

                <div class="col-span-2">
                  <label class="mb-1 block text-sm text-black dark:text-white">Variance</label>
                  <div
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium dark:border-form-strokedark dark:bg-form-input"
                  >
                    {{ calculateVariance(item.expectedQuantity, item.actualQuantity) }}
                  </div>
                </div>

                <div class="col-span-1 flex items-end justify-center">
                  <button
                    @click="removeItem(index)"
                    class="text-danger hover:text-meta-1"
                    :disabled="newCount.items.length === 1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="mt-2">
                <label class="mb-1 block text-sm text-black dark:text-white">Item Notes</label>
                <input
                  type="text"
                  v-model="item.notes"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  placeholder="Add notes about this item"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-4">
            <button
              @click="showCreateModal = false"
              class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              @click="createInventoryCount"
              class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="mr-2">
                <svg
                  class="animate-spin h-5 w-5 text-white"
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
              </span>
              Create Inventory Count
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Inventory Count Details Modal -->
    <div
      v-if="showDetailsModal && selectedCount"
      class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div
        class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
      >
        <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-black dark:text-white">Inventory Count Details</h3>
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
              <h4 class="text-lg font-semibold mb-3">Count Information</h4>
              <div class="space-y-2">
                <p>
                  <span class="font-medium">Count Number:</span>
                  {{ selectedCount.inventoryCount.countNumber }}
                </p>
                <p>
                  <span class="font-medium">Count Date:</span>
                  {{ formatDate(selectedCount.inventoryCount.countDate) }}
                </p>
                <p>
                  <span class="font-medium">Created:</span>
                  {{ formatDate(selectedCount.inventoryCount.createdAt) }}
                </p>
                <p>
                  <span class="font-medium">Created By:</span>
                  {{ selectedCount.inventoryCount.createdBy?.user.firstName || 'Unknown' }}
                </p>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h4 class="text-lg font-semibold mb-3">Count Items</h4>
            <div class="overflow-x-auto">
              <table class="w-full table-auto">
                <thead>
                  <tr class="bg-gray-2 text-left dark:bg-meta-4">
                    <th class="py-3 px-4 font-medium text-black dark:text-white">Product Name</th>
                    <th class="py-3 px-4 font-medium text-black dark:text-white">SKU</th>
                    <th class="py-3 px-4 font-medium text-black dark:text-white">Expected Qty</th>
                    <th class="py-3 px-4 font-medium text-black dark:text-white">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in selectedCount.inventoryCount.products"
                    :key="item._id"
                    class="border-b border-stroke dark:border-strokedark"
                  >
                    <td class="py-3 px-4">{{ item.product.name }}</td>
                    <td class="py-3 px-4">{{ item.product.sku }}</td>
                    <td class="py-3 px-4">{{ item.expectedQuantity }}</td>
                    <td class="py-3 px-4">{{ item.notes || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="selectedCount.notes" class="mb-6">
            <h4 class="text-lg font-semibold mb-2">Notes</h4>
            <div class="p-4 bg-gray-1 dark:bg-meta-4 rounded-md">
              {{ selectedCount.notes }}
            </div>
          </div>
          <div class="flex items-center justify-end mb-4">
            <button
              v-if="authStore.hasPermission('generate_reports')"
              @click="exportInventoryCountDetailsPDF"
              class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 mr-4 text-center font-medium text-white hover:bg-opacity-90"
            >
              Export PDF
            </button>

            <button
              @click="showDetailsModal = false"
              class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-4 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
