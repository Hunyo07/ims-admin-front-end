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
const purchaseOrders = ref([])
const suppliers = ref([])
const products = ref([])
const isLoading = ref(false)
const showCreateModal = ref(false)
const showDetailsModal = ref(false)
const selectedOrder = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const userLoading = ref(true);

// Pagination variables
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)

// Function to handle changing items per page
const changeItemsPerPage = () => {
  currentPage.value = 1 // Reset to first page when changing items per page
  fetchPurchaseOrders() // Refetch data with new pagination
}
// Form data for creating a new purchase order
const newOrder = ref({
  supplierId: '',
  items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  expectedDeliveryDate: null,
  notes: ''
})

// Computed property to filter products by selected supplier
const filteredProducts = computed(() => {
  if (!newOrder.value.supplierId) return []
  return products.value.filter(
    p => p.supplier && p.supplier._id === newOrder.value.supplierId
  )
})

// Fetch all purchase orders
const fetchPurchaseOrders = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/purchase-orders', {
      params: {
        page: currentPage.value,
        limit: itemsPerPage.value,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        search: searchQuery.value || undefined
      },
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    const data = response.data
    purchaseOrders.value = data.purchaseOrders || []
    totalItems.value = data.total || 0
    totalPages.value = data.pages || 0
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch purchase orders'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch suppliers
const fetchSuppliers = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/suppliers/suppliers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    suppliers.value = response.data
  } catch (error) {
    console.error('Error fetching suppliers:', error)
  }
}

// Fetch products
const fetchProducts = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/products', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
  }
}

// Add item to purchase order
const addItem = () => {
  newOrder.value.items.push({ productId: '', quantity: 1, unitPrice: 0 })
}

// Remove item from purchase order
const removeItem = (index) => {
  newOrder.value.items.splice(index, 1)
}

// Calculate total for an item
const calculateItemTotal = (item) => {
  return item.quantity * item.unitPrice
}

// Calculate total for the entire order
const calculateOrderTotal = computed(() => {
  return newOrder.value.items.reduce((total, item) => {
    return total + calculateItemTotal(item)
  }, 0)
})

// Set product price when product is selected
const setProductPrice = (index) => {
  const productId = newOrder.value.items[index].productId
  if (productId) {
    const product = products.value.find((p) => p._id === productId)
    if (product) {
      newOrder.value.items[index].unitPrice = product.costPrice || product.price * 0.7
    }
  }
}

// Create a new purchase order
const createPurchaseOrder = async () => {
  try {
    if (!newOrder.value.supplierId) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please select a supplier'
      })
      return
    }

    if (newOrder.value.items.some((item) => !item.productId || item.quantity <= 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Items',
        text: 'Please ensure all items have a product selected and a valid quantity'
      })
      return
    }

    isLoading.value = true

    // --- ADD THIS: Actually create the purchase order ---
    await axios.post(
      'http://localhost:5000/api/purchase-orders',
      {
        supplierId: newOrder.value.supplierId,
        items: newOrder.value.items,
        expectedDeliveryDate: newOrder.value.expectedDeliveryDate,
        notes: newOrder.value.notes
      },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )
    // --- END ADD ---

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase order created successfully'
    })

    // Reset form and close modal
    resetForm()
    showCreateModal.value = false

    // Refresh purchase orders list
    await fetchPurchaseOrders()
  } catch (error) {
    console.error('Error creating purchase order:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to create purchase order'
    })
  } finally {
    isLoading.value = false
  }
}

// Reset the form
const resetForm = () => {
  newOrder.value = {
    supplierId: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
    expectedDeliveryDate: null,
    notes: ''
  }
}

// View purchase order details
const viewOrderDetails = async (orderId) => {
  try {
    isLoading.value = true
    const response = await axios.get(`http://localhost:5000/api/purchase-orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    selectedOrder.value = response.data
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching purchase order details:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch purchase order details'
    })
  } finally {
    isLoading.value = false
  }
}
const exportPurchaseOrderDetailsPDF = () => {
  try {
    if (!selectedOrder.value) return
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const marginLeft = 20
    const marginRight = 20
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - marginLeft - marginRight
    const lineHeight = 7
    let currentY = 20

    // Add header with title
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Purchase Order Details', pageWidth / 2, currentY, { align: 'center' })
    currentY += 12

    // Add a horizontal line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY)
    currentY += 8

    // Order Number and Date
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Order #: ${selectedOrder.value.orderNumber}`, marginLeft, currentY)
    
    // Generated On
    const now = new Date()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated on: ${format(now, 'MMM dd, yyyy h:mm a')}`, pageWidth - marginRight, currentY, { align: 'right' })
    currentY += 15

    // Order Information Section
    doc.setDrawColor(240, 240, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(marginLeft, currentY, contentWidth / 2 - 5, 50, 2, 2, 'FD')
    doc.roundedRect(marginLeft + contentWidth / 2 + 5, currentY, contentWidth / 2 - 5, 50, 2, 2, 'FD')
    
    // Order Information
    currentY += 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Order Information', marginLeft + 5, currentY)
    currentY += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    doc.text(`Status: ${selectedOrder.value.status.charAt(0).toUpperCase() + selectedOrder.value.status.slice(1)}`, marginLeft + 5, currentY)
    currentY += lineHeight - 2
    
    doc.text(`Created: ${formatDate(selectedOrder.value.createdAt)}`, marginLeft + 5, currentY)
    currentY += lineHeight - 2
    
    doc.text(`Expected Delivery: ${formatDate(selectedOrder.value.expectedDeliveryDate) || 'N/A'}`, marginLeft + 5, currentY)
    currentY += lineHeight - 2
    
    if (selectedOrder.value.receivedDate) {
      doc.text(`Received: ${formatDate(selectedOrder.value.receivedDate)}`, marginLeft + 5, currentY)
      currentY += lineHeight - 2
    }
    
    doc.text(`Total Amount: ${formatCurrencyForPDF(selectedOrder.value.totalAmount)}`, marginLeft + 5, currentY)
    
    // Supplier Information
    currentY = currentY - (lineHeight - 2) * (selectedOrder.value.receivedDate ? 4 : 3)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Supplier Information', marginLeft + contentWidth / 2 + 10, currentY)
    currentY += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    doc.text(`Supplier: ${selectedOrder.value.supplier?.name || 'N/A'}`, marginLeft + contentWidth / 2 + 10, currentY)
    currentY += lineHeight - 2
    
    doc.text(`Contact: ${selectedOrder.value.supplier.contactPerson || 'N/A'}`, marginLeft + contentWidth / 2 + 10, currentY)
    currentY += lineHeight - 2
    
    doc.text(`Phone: ${selectedOrder.value.supplier.phone || 'N/A'}`, marginLeft + contentWidth / 2 + 10, currentY)
    currentY += lineHeight - 2
    
    doc.text(`Email: ${selectedOrder.value.supplier.email || 'N/A'}`, marginLeft + contentWidth / 2 + 10, currentY)
    
    // Reset Y position after the boxes
    currentY += 20

    // Order Items Table
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Order Items', marginLeft, currentY)
    currentY += 8

    // Table headers
    const headers = [['Product', 'SKU', 'Quantity', 'Unit Price', 'Total']]
    
    // Table data
    const data = selectedOrder.value.items.map(item => [
      item.product.name.length > 25 ? item.product.name.substring(0, 25) + '...' : item.product.name,
      item.product.sku,
      item.quantity.toString(),
      formatCurrencyForPDF(item.unitPrice),
      formatCurrencyForPDF(item.total)
    ])

    // Add total row
    data.push([
      { content: 'Total:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatCurrencyForPDF(selectedOrder.value.totalAmount), styles: { fontStyle: 'bold' } }
    ])

      // Generate the table
      // doc.autoTable({
      //   startY: currentY,
      //   head: headers,
      //   body: data,
      //   theme: 'grid',
      //   headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      //   styles: { fontSize: 9, cellPadding: 3 },
      //   columnStyles: {
      //     0: { cellWidth: 60 },
      //     1: { cellWidth: 30 },
      //     2: { cellWidth: 20, halign: 'center' },
      //     3: { cellWidth: 30, halign: 'right' },
      //     4: { cellWidth: 30, halign: 'right' }
      //   },
      //   margin: { left: marginLeft, right: marginRight }
      // })
      autoTable(doc, {
  startY: currentY,
  head: headers,
  body: data,
  theme: 'grid',
  headStyles: {
    fillColor: [240, 240, 240],
    textColor: [0, 0, 0],
    fontStyle: 'bold'
  },
  styles: {
    fontSize: 9,
    cellPadding: 3
  },
  columnStyles: {
    0: { cellWidth: 60 },
    1: { cellWidth: 30 },
    2: { cellWidth: 20, halign: 'center' },
    3: { cellWidth: 30, halign: 'right' },
    4: { cellWidth: 30, halign: 'right' }
  },
  margin: { left: marginLeft, right: marginRight }
})

    // Update current Y position after the table
    currentY = doc.lastAutoTable.finalY + 10

    // Add notes if available
    if (selectedOrder.value.notes) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Notes', marginLeft, currentY)
      currentY += 7

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setDrawColor(240, 240, 240)
      doc.setFillColor(250, 250, 250)
      
      // Create a box for notes
      doc.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, 'FD')
      
      // Add notes text with word wrapping
      const splitNotes = doc.splitTextToSize(selectedOrder.value.notes, contentWidth - 10)
      doc.text(splitNotes, marginLeft + 5, currentY + 5)
    }

    // Add footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      doc.text(
        `Created by: ${selectedOrder.value.createdBy?.name || 'Unknown'} | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    // Save the PDF
    doc.save(`Purchase_Order_${selectedOrder.value.orderNumber}_${format(now, 'yyyy-MM-dd')}.pdf`)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase order details exported successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })

  } catch (error) {
    console.error('Error exporting purchase order details to PDF:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to export purchase order details'
    })
  }
}
// Update purchase order status
const updateOrderStatus = async (orderId, newStatus) => {
  try {
    isLoading.value = true
    await axios.patch(
      `http://localhost:5000/api/purchase-orders/${orderId}/status`,
      { status: newStatus },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase order status updated successfully'
    })

    // Refresh purchase orders list and details if modal is open
    await fetchPurchaseOrders()
    if (selectedOrder.value && selectedOrder.value._id === orderId) {
      await viewOrderDetails(orderId)
    }
  } catch (error) {
    console.error('Error updating purchase order status:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update purchase order status'
    })
  } finally {
    isLoading.value = false
  }
}

// Generate purchase orders from reorder points
const generateFromReorderPoints = async () => {
  try {
    isLoading.value = true

    Swal.fire({
      title: 'Processing',
      text: 'Checking stock levels and creating purchase orders...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    const response = await axios.post(
      'http://localhost:5000/api/reorder/auto-reorder',
      {},
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Refresh purchase orders list
    await fetchPurchaseOrders()

    Swal.fire({
      icon: 'success',
      title: 'Auto Reorder Complete',
      text: `Created ${
        response.data.ordersCreated || 0
      } purchase orders for products that need reordering`,
      confirmButtonText: 'OK'
    })
  } catch (error) {
    console.error('Error generating purchase orders:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to generate purchase orders'
    })
  } finally {
    isLoading.value = false
  }
}

// For now, we'll use the purchase orders directly since pagination is handled server-side
const paginatedPurchaseOrders = computed(() => {
  return purchaseOrders.value || []
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

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

// Get status badge class
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-warning text-white'
    case 'approved':
      return 'bg-blue-500 text-white'
    case 'shipped':
      return 'bg-yellow-600 text-white'
    case 'received':
      return 'bg-success text-white'
    case 'cancelled':
      return 'bg-danger text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}
// Add a function specifically for PDF formatting to avoid the '+' sign issue
const formatCurrencyForPDF = (amount) => {
  // Format without using Intl.NumberFormat to avoid compatibility issues with jsPDF
  return 'PHP ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const exportPurchaseOrdersPDF = () => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const marginLeft = 20
    const marginRight = 20
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - marginLeft - marginRight
    const lineHeight = 7
    let currentY = 20

    // Add header with logo and company info
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Purchase Orders Report', pageWidth / 2, currentY, { align: 'center' })
    currentY += 12

    // Add a horizontal line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY)
    currentY += 8

    // Status filter info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    let statusText = 'All Statuses'
    if (statusFilter.value !== 'all') {
      statusText = statusFilter.value.charAt(0).toUpperCase() + statusFilter.value.slice(1)
    }
    doc.text(`Status Filter: ${statusText}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 5

    // Generated On
    const now = new Date()
    doc.setFontSize(8)
    doc.text(`Generated on: ${format(now, 'MMM dd, yyyy h:mm a')}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 15

    // Purchase Orders Statistics
    doc.setDrawColor(240, 240, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(marginLeft, currentY, contentWidth, 40, 2, 2, 'FD')
    
    currentY += 8
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Purchase Orders Summary', marginLeft + 10, currentY)
    currentY += 10

    // Calculate statistics
    const totalOrders = paginatedPurchaseOrders.value.length
    const totalAmount = paginatedPurchaseOrders.value.reduce((sum, order) => sum + order.totalAmount, 0)
    const pendingOrders = paginatedPurchaseOrders.value.filter(order => order.status === 'pending').length
    const receivedOrders = paginatedPurchaseOrders.value.filter(order => order.status === 'received').length
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    
    // Create a 2x2 grid for statistics
    const colWidth = contentWidth / 2
    
    // Row 1
    doc.text(`Total Orders: ${totalOrders}`, marginLeft + 10, currentY)
    doc.text(`Total Amount: ${formatCurrencyForPDF(totalAmount)}`, marginLeft + 10 + colWidth, currentY)
    currentY += lineHeight
    
    // Row 2
    doc.text(`Pending Orders: ${pendingOrders}`, marginLeft + 10, currentY)
    doc.text(`Received Orders: ${receivedOrders}`, marginLeft + 10 + colWidth, currentY)
    
    currentY += 15

    // Purchase Orders Table
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Purchase Orders', marginLeft, currentY)
    currentY += 8

    // Table headers with background
    const headers = ['Order #', 'Supplier', 'Total', 'Status', 'Created']
    const colWidths = [30, 60, 30, 30, 30]
    
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
    let currentPageNum = 1
    
    // Function to add header to new pages
    const addTableHeader = () => {
      currentY = 20
      
      // Add page header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Purchase Orders Report - Continued', pageWidth / 2, currentY, { align: 'center' })
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
    paginatedPurchaseOrders.value.forEach((order, index) => {
      // Check if we need a new page
      if (itemsOnCurrentPage >= itemsPerPage) {
        doc.addPage()
        currentPageNum++
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
        order.orderNumber,
        order.supplier?.name && order.supplier.name.length > 25 ? order.supplier.name.substring(0, 25) + '...' : (order.supplier?.name || 'N/A'),
        formatCurrencyForPDF(order.totalAmount),
        order.status.charAt(0).toUpperCase() + order.status.slice(1),
        format(new Date(order.createdAt), 'MMM dd, yyyy')
      ]
      
      // Draw row data
      for (let i = 0; i < rowData.length; i++) {
        doc.text(rowData[i], positions[i] + 2, currentY + 4)
      }
      
      currentY += lineHeight
      itemsOnCurrentPage++
    })

    // Footer with pagination on all pages
    for (let i = 1; i <= currentPageNum; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      doc.text(`Page ${i} of ${currentPageNum}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' })
    }

    doc.save(`Purchase_Orders_Report_${format(now, 'yyyy-MM-dd')}.pdf`)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase orders report exported successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })

  } catch (error) {
    console.error('Error exporting purchase orders to PDF:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to export purchase orders report'
    })
  }
}
onMounted(async () => {
  await authStore.fetchCurrentUser();
  userLoading.value = false;
  fetchPurchaseOrders();
  fetchSuppliers();
  fetchProducts();
});

const canApproveOrder = computed(() => {
  const user = authStore.user;
  return user && user.role && (user.role.name === 'superadmin' || user.role === 'superadmin');
});
const canCreateOrder = computed(() => authStore.hasRole(['admin', 'superadmin']));
const canExportPDF = computed(() => authStore.hasRole(['admin', 'superadmin']));

// Function to handle status filter changes
const handleStatusFilterChange = () => {
  currentPage.value = 1 // Reset to first page when filter changes
  fetchPurchaseOrders()
}

// Function to handle search
const handleSearch = () => {
  currentPage.value = 1 // Reset to first page when searching
  fetchPurchaseOrders()
}

// Function to handle pagination navigation
const goToPage = (page) => {
  currentPage.value = page;
  fetchPurchaseOrders();
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value = currentPage.value - 1;
    fetchPurchaseOrders();
  }
}

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value = currentPage.value + 1;
    fetchPurchaseOrders();
  }
}

// Function to get visible page numbers for pagination
const getVisiblePages = () => {
  const pages = [];
  const maxVisible = 5;
  const start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages.value, start + maxVisible - 1);
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
};

// Computed properties for pagination display
const paginationStart = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value + 1;
});

const paginationEnd = computed(() => {
  return Math.min(currentPage.value * itemsPerPage.value, totalItems.value);
});
</script>

<template>
  <div>
    
  
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-xl font-semibold text-black dark:text-white">Purchase Orders Management</h3>
        <div class="flex items-center gap-3">
          <button
            v-if="canCreateOrder"
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
            Create Purchase Order
          </button>
          <button
            @click="generateFromReorderPoints"
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
                d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L13.586 9H10a1 1 0 110-2h3.586l-2.293-2.293A1 1 0 0112 2z"
                clip-rule="evenodd"
              />
            </svg>
            Generate from Reorder Points
          </button>
          <button
            @click="exportPurchaseOrdersPDF"
            class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                clip-rule="evenodd"
              />
            </svg>
            Export PDF
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
            @input="handleSearch"
            placeholder="Search by order number or supplier..."
            class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-4 pr-4 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
        <div>
          <select
            v-model="statusFilter"
            @change="handleStatusFilterChange"
            class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="shipped">Shipped</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Purchase Orders Table -->
    <div class="p-4">
      <div v-if="userLoading" class="flex justify-center items-center py-10">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
      <div v-else>
        <div v-if="isLoading" class="flex justify-center items-center py-10">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="paginatedPurchaseOrders.length === 0" class="text-center py-10">
          <p class="text-lg text-gray-500 dark:text-gray-400">No purchase orders found</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-4 px-4 font-medium text-black dark:text-white">Order #</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Supplier</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Total</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Status</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Created</th>
                <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in paginatedPurchaseOrders"
                :key="order._id"
                class="border-b border-stroke dark:border-strokedark"
              >
                <td class="py-3 px-4">{{ order.orderNumber }}</td>
                <td class="py-3 px-4">{{ order.supplier?.name || 'N/A' }}</td>
                <td class="py-3 px-4">{{ formatCurrency(order.totalAmount) }}</td>
                <td class="py-3 px-4">
                  <span
                    :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                      order.status
                    )}`"
                  >
                    {{ order.status.charAt(0).toUpperCase() + order.status.slice(1) }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ formatDate(order.createdAt) }}</td>
                <td class="py-3 px-4">
                  <div class="flex items-center space-x-2">
                    <button
                      @click="viewOrderDetails(order._id)"
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

                    <button
                      v-if="order.status === 'approved' && canApproveOrder"
                      @click="updateOrderStatus(order._id, 'shipped')"
                      class="hover:text-info"
                      title="Mark as Shipped"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                        />
                        <path
                          d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-4a1 1 0 00-1-1h-8a1 1 0 00-.8.4L8.65 8H4a1 1 0 00-1-1V4z"
                        />
                      </svg>
                    </button>

                    <button
                      v-if="order.status === 'shipped' && canApproveOrder"
                      @click="updateOrderStatus(order._id, 'received')"
                      class="hover:text-success"
                      title="Mark as Received"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"
                        />
                      </svg>
                    </button>

                    <button
                      v-if="['pending', 'approved'].includes(order.status) && canApproveOrder"
                      @click="updateOrderStatus(order._id, 'cancelled')"
                      class="hover:text-danger"
                      title="Cancel"
                    >
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
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Pagination Controls -->
      <div v-if="totalItems > 0" class="flex items-center justify-between px-4 py-3 bg-white dark:bg-boxdark border-t border-stroke dark:border-strokedark">
        <div class="flex items-center space-x-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Showing {{ paginationStart }} to {{ paginationEnd }} of {{ totalItems }} results
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          <select
            v-model="itemsPerPage"
            @change="changeItemsPerPage"
            class="rounded border border-stroke bg-transparent py-1 px-2 text-sm dark:border-strokedark dark:bg-form-input"
          >
            <option value="5">5 per page</option>
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
          </select>
          
          <div v-if="totalPages > 1" class="flex items-center space-x-2">
            <button
              @click="goToPreviousPage"
              :disabled="currentPage === 1"
              class="px-3 py-1 text-sm border border-stroke rounded hover:bg-gray-50 dark:border-strokedark dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div class="flex items-center space-x-1">
              <button
                v-for="page in getVisiblePages()"
                :key="page"
                @click="goToPage(page)"
                :class="`px-3 py-1 text-sm rounded ${
                  currentPage === page
                    ? 'bg-primary text-white'
                    : 'border border-stroke hover:bg-gray-50 dark:border-strokedark dark:hover:bg-meta-4'
                }`"
              >
                {{ page }}
              </button>
            </div>
            
            <button
              @click="goToNextPage"
              :disabled="currentPage === totalPages"
              class="px-3 py-1 text-sm border border-stroke rounded hover:bg-gray-50 dark:border-strokedark dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          
          <div v-else class="text-sm text-gray-500 dark:text-gray-400">
            All {{ totalItems }} results shown
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Purchase Order Modal -->
  <div
    v-if="showCreateModal"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">Create Purchase Order</h3>
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
        <div class="mb-4.5 grid grid-cols-2 gap-6">
          <div class="col-span-1">
            <label class="mb-2.5 block text-black dark:text-white">
              Supplier <span class="text-meta-1">*</span>
            </label>
            <select
              v-model="newOrder.supplierId"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            >
              <option value="" disabled>Select Supplier</option>
              <option v-for="supplier in suppliers" :key="supplier._id" :value="supplier._id">
                {{ supplier.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white"> Expected Delivery Date </label>
          <Datepicker
            v-model="newOrder.expectedDeliveryDate"
            class="w-full"
            :enable-time-picker="false"
            :min-date="new Date()"
            placeholder="Select delivery date"
          />
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white"> Notes </label>
          <textarea
            v-model="newOrder.notes"
            rows="3"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            placeholder="Add notes about this order"
          ></textarea>
        </div>

        <div class="mb-4.5">
          <div class="flex items-center justify-between mb-2.5">
            <label class="block text-black dark:text-white">
              Order Items <span class="text-meta-1">*</span>
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
            v-for="(item, index) in newOrder.items"
            :key="index"
            class="mb-3 p-3 border border-stroke rounded-md dark:border-strokedark"
          >
            <div class="grid grid-cols-12 gap-3">
              <div class="col-span-5">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Product <span class="text-meta-1">*</span>
                </label>
                <select
                  v-model="item.productId"
                  @change="setProductPrice(index)"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                >
                  <option value="" disabled>Select Product</option>
                  <option v-for="product in filteredProducts" :key="product._id" :value="product._id">
                    {{ product.name }} ({{ product.sku }})
                  </option>
                </select>
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Quantity <span class="text-meta-1">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="item.quantity"
                  min="1"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Unit Price <span class="text-meta-1">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="item.unitPrice"
                  min="0"
                  step="0.01"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white"> Total </label>
                <div
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium dark:border-form-strokedark dark:bg-form-input"
                >
                  ₱{{ calculateItemTotal(item).toFixed(2) }}
                </div>
              </div>

              <div class="col-span-1 flex items-end justify-center">
                <button
                  @click="removeItem(index)"
                  class="text-danger hover:text-meta-1"
                  :disabled="newOrder.items.length === 1"
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
          </div>
        </div>

        <div class="mb-6 flex justify-end">
          <div class="text-lg font-semibold">Total: {{ formatCurrency(calculateOrderTotal) }}</div>
        </div>

        <div class="flex items-center justify-end gap-4">
          <button
            @click="showCreateModal = false"
            class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            @click="createPurchaseOrder"
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
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Purchase Order Details Modal -->
  <div
    v-if="showDetailsModal && selectedOrder"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">Purchase Order Details</h3>
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
            <h4 class="text-lg font-semibold mb-3">Order Information</h4>
            <div class="space-y-2">
              <p><span class="font-medium">Order Number:</span> {{ selectedOrder.orderNumber }}</p>
              <p>
                <span class="font-medium">Status:</span>
                <span
                  :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                    selectedOrder.status
                  )}`"
                >
                  {{ selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1) }}
                </span>
              </p>
              <p>
                <span class="font-medium">Created:</span> {{ formatDate(selectedOrder.createdAt) }}
              </p>
              <p>
                <span class="font-medium">Expected Delivery:</span>
                {{ formatDate(selectedOrder.expectedDeliveryDate) }}
              </p>
              <p v-if="selectedOrder.receivedDate">
                <span class="font-medium">Received:</span>
                {{ formatDate(selectedOrder.receivedDate) }}
              </p>
              <p>
                <span class="font-medium">Total Amount:</span>
                {{ formatCurrency(selectedOrder.totalAmount) }}
              </p>
            </div>
          </div>

          <div class="col-span-1">
            <h4 class="text-lg font-semibold mb-3">Supplier & Branch</h4>
            <div class="space-y-2">
              <p><span class="font-medium">Supplier:</span> {{ selectedOrder.supplier?.name || 'N/A' }}</p>
              <p>
                <span class="font-medium">Contact:</span>
                {{ selectedOrder.supplier.contactPerson || 'N/A' }}
              </p>
              <p>
                <span class="font-medium">Phone:</span> {{ selectedOrder.supplier.phone || 'N/A' }}
              </p>
              <p>
                <span class="font-medium">Email:</span> {{ selectedOrder.supplier.email || 'N/A' }}
              </p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-lg font-semibold mb-3">Order Items</h4>
          <div class="overflow-x-auto">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Product</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">SKU</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Quantity</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Unit Price</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in selectedOrder.items"
                  :key="item._id"
                  class="border-b border-stroke dark:border-strokedark"
                >
                  <td class="py-3 px-4">{{ item.product.name }}</td>
                  <td class="py-3 px-4">{{ item.product.sku }}</td>
                  <td class="py-3 px-4">{{ item.quantity }}</td>
                  <td class="py-3 px-4">{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="py-3 px-4">{{ formatCurrency(item.total) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="py-3 px-4 text-right font-semibold">Total:</td>
                  <td class="py-3 px-4 font-semibold">
                    {{ formatCurrency(selectedOrder.totalAmount) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div v-if="selectedOrder.notes" class="mb-6">
          <h4 class="text-lg font-semibold mb-2">Notes</h4>
          <div class="p-4 bg-gray-1 dark:bg-meta-4 rounded-md">
            {{ selectedOrder.notes }}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Created by: {{ selectedOrder.createdBy?.name || 'Unknown' }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
      v-if="canExportPDF"
      @click="exportPurchaseOrderDetailsPDF"
      class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 mr-1"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
          clip-rule="evenodd"
        />
      </svg>
      Export PDF
    </button>
            <button
              v-if="selectedOrder.status === 'pending' && canApproveOrder"
              @click="updateOrderStatus(selectedOrder._id, 'approved')"
              class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
            >
              Approve Order
            </button>

            <button
              v-if="selectedOrder.status === 'approved' && canApproveOrder"
              @click="updateOrderStatus(selectedOrder._id, 'shipped')"
              class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-white hover:bg-opacity-90"
            >
              Mark as Shipped
            </button>

            <button
              v-if="selectedOrder.status === 'shipped' && canApproveOrder"
              @click="updateOrderStatus(selectedOrder._id, 'received')"
              class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
            >
              Mark as Received
            </button>

            <button
              v-if="['pending', 'approved'].includes(selectedOrder.status) && canApproveOrder"
              @click="updateOrderStatus(selectedOrder._id, 'cancelled')"
              class="inline-flex items-center justify-center rounded-md bg-danger py-2 px-4 text-white hover:bg-opacity-90"
            >
              Cancel Order
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
</div>
</template>
