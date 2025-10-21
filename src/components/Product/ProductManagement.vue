<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores'
import { socket } from '../../socket'
import Swal from 'sweetalert2'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
const authStore = useAuthStore()

// Update interfaces
interface Product {
  _id: string
  name: string
  description: string
  category: any
  // subCategory: any
  brand?: any
  supplier: any
  price: number
  costPrice: number
  unit: string
  currentStock: number
  images: Array<{ url: string }> | string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy?: {
    user:
      | string
      | {
          _id: string
          firstName: string
          lastName: string
          email: string
        }
    role: string
  }
  sku?: string
  barcode?: { text: string }
  hasSerialNumbers?: boolean
  serialNumbers?: string[]
  hasAssetControlNumber?: boolean
  assetControlNumbers?: string[]
}
// Update refs
const imagePreview = ref<string | null>(null)
const isFetchingCategories = ref(false)
const isFetchingBrands = ref(false)
const suppliers = ref<any[]>([])
const subCategories = ref<any[]>([])
const categories = ref<any[]>([])
const brands = ref<any[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const products = ref<Product[]>([])
const selectedProductId = ref<string | null>(null)
const editingProduct = ref<Product | null>(null)
const nextItemId = ref<number>(1)

// Computer Desktop specifications
const computerSpecs = ref({
  processor: '',
  storage: '',
  ram: '',
  videoCard: '',
  psu: '',
  motherboard: ''
})

// Check if selected category is Computer Desktop
const isComputerDesktop = computed(() => {
  const selectedCategory = categories.value.find((cat) => cat._id === newProduct.value.categoryId)
  return (
    selectedCategory?.name?.toLowerCase().includes('computer desktop') ||
    selectedCategory?.name?.toLowerCase().includes('desktop computer') ||
    selectedCategory?.name?.toLowerCase() === 'desktop'
  )
})

const fetchNextItemId = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/products/', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    const products = response.data.products || []
    const maxItemId = products.reduce((max: number, product: any) => {
      const itemId = product.itemId || 0
      return Math.max(max, itemId)
    }, 0)
    nextItemId.value = maxItemId + 1
  } catch (error) {
    nextItemId.value = 1
  }
}
// Details modal state
const showDetailsModal = ref(false)
const detailsProduct = ref<Product | null>(null)
// Add these refs for validation errors (ensure not shadowed)
const skuError = ref('')
const barcodeError = ref('')
// Add these refs
const filters = ref({
  categoryId: '',
  status: '',
  priceRange: '',
  minPrice: 0,
  maxPrice: 0
})
// Update ProductForm type to make sku and barcodeText optional
interface ProductForm {
  name: string
  description: string
  categoryId: string
  brandId: string
  supplierId: string
  unit: string
  currentStock: string
  specifications: { name: string; value: string }[]
  images: File | null
  sku?: string
  barcodeText?: string
  hasSerialNumbers: boolean
  serialNumbersText?: string
  hasAssetControlNumber: boolean
  assetControlNumbersText?: string
}
const newProduct = ref<ProductForm>({
  name: '',
  description: '',
  categoryId: '',
  brandId: '',
  supplierId: '',
  unit: '',
  currentStock: '',
  specifications: [{ name: '', value: '' }],
  images: null,
  sku: '',
  barcodeText: '',
  hasSerialNumbers: false,
  serialNumbersText: '',
  hasAssetControlNumber: false,
  assetControlNumbersText: ''
})
// Parse and validate serials against current stock on the client side
const parsedSerials = computed<string[]>(() => {
  const text = newProduct.value.serialNumbersText || ''
  if (!newProduct.value.hasSerialNumbers || !text.trim()) return []
  let arr: string[] = []
  try {
    // Try JSON parse first
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) arr = parsed.map((s) => String(s))
  } catch (_) {
    // Fallback: split by newline or comma
    arr = text
      .split(/\r?\n|,/) // newline or comma
      .map((s) => s.trim())
      .filter(Boolean)
  }
  // Deduplicate and normalize
  const deduped = Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean)
  return deduped
})
const serialsCount = computed<number>(() => parsedSerials.value.length)
const currentStockNumber = computed<number>(() => parseInt(newProduct.value.currentStock) || 0)
const serialsError = computed<string>(() => {
  if (!newProduct.value.hasSerialNumbers) return ''
  if (serialsCount.value > currentStockNumber.value) {
    return `Serials (${serialsCount.value}) exceed stock (${currentStockNumber.value}).`
  }
  return ''
})

const acnInfo = computed<string>(() => {
  if (newProduct.value.hasSerialNumbers) {
    return `${serialsCount.value} ACNs will be auto-generated, each paired with a serial number (Format: CAT-###-YY-###)`
  } else if (newProduct.value.hasAssetControlNumber) {
    const acnText = newProduct.value.assetControlNumbersText?.trim()
    if (!acnText) {
      return 'One ACN will be auto-generated for this item (Format: CAT-###-YY-###)'
    } else {
      const count = acnText.split(/\r?\n|,/).filter((s) => s.trim()).length
      return `${count} custom ACN(s) provided`
    }
  }
  return ''
})
const handleSerialToggle = () => {
  // Rule 1: If hasSerialNumbers is true, require ACN automatically
  if (newProduct.value.hasSerialNumbers) {
    newProduct.value.hasAssetControlNumber = true
  }
}

const handleImageChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (!file) return

  if (file.size > maxSize) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Image size should not exceed 5MB'
    })
    target.value = ''
    return
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!validTypes.includes(file.type)) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Please upload a valid image file (JPEG, PNG, or GIF)'
    })
    target.value = ''
    return
  }

  newProduct.value.images = file
  imagePreview.value = URL.createObjectURL(file)
}
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  const np = newProduct.value
  return (
    np.name !== '' ||
    np.description !== '' ||
    np.categoryId !== '' ||
    np.brandId !== '' ||
    np.supplierId !== '' ||
    np.unit !== '' ||
    np.currentStock !== '' ||
    (np.specifications && np.specifications.length > 0) ||
    np.images !== null ||
    np.sku !== '' ||
    np.barcodeText !== ''
  )
})
const handleCloseModal = async () => {
  if (hasUnsavedChanges.value) {
    const result = await Swal.fire({
      title: 'Unsaved Changes',
      text: 'You have unsaved changes. Are you sure you want to close?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, discard changes',
      cancelButtonText: 'No, keep editing',
      customClass: {
        confirmButton:
          'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
        cancelButton:
          'swal2-cancel bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
      }
    })
    if (!result.isConfirmed) return
  }

  // Clear image preview
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
  }

  showModal.value = false
  resetForm()
}
// const formatPrice = (price: number) => {
//   return new Intl.NumberFormat('en-PH', {
//     style: 'currency',
//     currency: 'PHP'
//   }).format(price)
// }

// Format currency for PDF to avoid the '+' sign issue
const formatCurrencyForPDF = (amount: number) => {
  // Format without using Intl.NumberFormat to avoid compatibility issues with jsPDF
  return 'PHP ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const exportProductsPDF = () => {
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

    // Add header with title
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Product Inventory Report', pageWidth / 2, currentY, { align: 'center' })
    currentY += 12

    // Add a horizontal line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY)
    currentY += 8

    // Generated info
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const now = new Date()
    doc.text(`Generated on: ${format(now, 'MMM dd, yyyy h:mm a')}`, pageWidth / 2, currentY, {
      align: 'center'
    })
    currentY += 15

    // Inventory Statistics in a nice box
    doc.setDrawColor(240, 240, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(marginLeft, currentY, contentWidth, 40, 2, 2, 'FD')

    currentY += 8
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Inventory Statistics', marginLeft + 10, currentY)
    currentY += 10

    // Calculate inventory statistics
    const totalProducts = filteredProducts.value.length
    const activeProducts = filteredProducts.value.filter((p) => p.isActive).length
    const totalValue = filteredProducts.value.reduce(
      (sum, product) => sum + product.price * product.currentStock,
      0
    )
    const totalStock = filteredProducts.value.reduce(
      (sum, product) => sum + product.currentStock,
      0
    )

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)

    // Create a 2x2 grid for statistics
    const colWidth = contentWidth / 2

    // Row 1
    doc.text(`Total Products: ${totalProducts}`, marginLeft + 10, currentY)
    doc.text(`Active Products: ${activeProducts}`, marginLeft + 10 + colWidth, currentY)
    currentY += lineHeight

    // Row 2
    doc.text(
      `Total Inventory Value: ${formatCurrencyForPDF(totalValue)}`,
      marginLeft + 10,
      currentY
    )
    doc.text(`Total Stock Items: ${totalStock}`, marginLeft + 10 + colWidth, currentY)

    currentY += 15

    // Products Table
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Item list', marginLeft, currentY)
    currentY += 8

    // Table headers with background
    const headers = ['Item Name', 'Category', 'Price', 'Cost', 'Stock', 'Status']
    const colWidths = [50, 35, 25, 25, 20, 25]

    // Calculate positions for columns
    const positions: number[] = []
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
    const itemsPerPage = 25
    let itemsOnCurrentPage = 0
    // let totalPages = Math.ceil(filteredProducts.value.length / itemsPerPage)
    let currentPage = 1

    // Function to add header to new pages
    const addTableHeader = () => {
      currentY = 20

      // Add page header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Product Inventory Report - Continued', pageWidth / 2, currentY, { align: 'center' })
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
    filteredProducts.value.forEach((product, index) => {
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
        product.name.length > 25 ? product.name.substring(0, 25) + '...' : product.name,
        product.category?.name || 'Not Assigned',
        formatCurrencyForPDF(product.price),
        formatCurrencyForPDF(product.costPrice),
        `${product.currentStock} ${product.unit}`,
        product.isActive ? 'Active' : 'Inactive'
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
      doc.text(`Page ${i} of ${currentPage}`, pageWidth / 2, doc.internal.pageSize.height - 10, {
        align: 'center'
      })
    }

    doc.save(`Product_Inventory_${format(now, 'yyyy-MM-dd')}.pdf`)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Product inventory report exported successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
  } catch (error) {
    console.error('Error exporting products to PDF:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to export product inventory report'
    })
  }
}
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/products/', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    // Make sure we're setting an array
    products.value = response.data.products || []

    // Calculate next item ID
    const maxItemId = products.value.reduce((max, product) => {
      const itemId = (product as any).itemId || 0
      return Math.max(max, itemId)
    }, 0)
    nextItemId.value = maxItemId + 1
  } catch (error: any) {
    console.error('Error fetching products:', error)
    products.value = []
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching products'
    })
  } finally {
    isLoading.value = false
  }
}
// Add these fetch functions
const fetchSuppliers = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/suppliers/suppliers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    suppliers.value = response.data?.filter((supplier: any) => supplier?.isActive) || []
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    suppliers.value = []
  }
}
const fetchSubCategories = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/subcategories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    subCategories.value = response.data?.filter((subCategory: any) => subCategory?.isActive) || []
  } catch (error: any) {
    console.error('Error fetching subcategories:', error)
    subCategories.value = []
  }
}

const fetchBrands = async () => {
  isFetchingBrands.value = true
  try {
    const response = await axios.get('http://localhost:5000/api/brands/active', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    brands.value = response.data || []
  } catch (error: any) {
    console.error('Error fetching brands:', error)
    brands.value = []
  } finally {
    isFetchingBrands.value = false
  }
}

// Update fetch function
const fetchCategories = async () => {
  isFetchingCategories.value = true

  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/categories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    categories.value = (response.data || []).map((category: any) => ({
      ...category,
      branch: category.branch || { name: 'Not Assigned' }
    }))
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    categories.value = [] // Set empty array on error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching categories'
    })
  } finally {
    isFetchingCategories.value = false
    isLoading.value = false
  }
}
// Update computed properties

const filteredProducts = computed(() => {
  return products.value.filter((product) => {
    const searchLower = searchQuery.value.toLowerCase()
    const matchesSearch =
      product.name.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower)

    const matchesCategory =
      !filters.value.categoryId || product.category?._id === filters.value.categoryId
    const matchesStatus =
      !filters.value.status || product.isActive === (filters.value.status === 'active')
    const matchesPrice =
      !filters.value.priceRange ||
      (filters.value.priceRange === 'custom'
        ? product.price >= filters.value.minPrice && product.price <= filters.value.maxPrice
        : matchPriceRange(product.price, filters.value.priceRange))

    return matchesSearch && matchesCategory && matchesStatus && matchesPrice
  })
})
const matchPriceRange = (price: number, range: string) => {
  switch (range) {
    case 'under1000':
      return price < 1000
    case '1000to5000':
      return price >= 1000 && price <= 5000
    case 'over5000':
      return price > 5000
    default:
      return true
  }
}
const totalPages = computed(() => {
  return Math.ceil(filteredProducts.value.length / itemsPerPage.value)
})
// Brand options from brands API
// const brandOptions = computed(() => {
//   return brands.value.filter((brand) => brand.isActive)
// })

// const filteredSubCategories = computed(() => {
//   if (!newProduct.value.categoryId) return []
//   return (subCategories.value as any[]).filter(
//     (sub: any) => sub.category && sub.category._id === newProduct.value.categoryId
//   )
// })
const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
})

// Check if user can edit a specific product
const canEditProduct = (product: Product) => {
  // Get user ID (handle both id and _id)
  const userId = authStore.user?.id || authStore.user?._id

  // If no user is logged in, can't edit
  if (!authStore.user || !userId) {
    return false
  }

  // Superadmins can edit any product
  if (authStore.isSuperAdmin()) {
    return true
  }

  // Check if user is the creator of the product
  if (product.createdBy && product.createdBy.user) {
    const creatorId =
      typeof product.createdBy.user === 'object'
        ? product.createdBy.user._id
        : product.createdBy.user
    if (creatorId === userId) {
      return true
    }
  }

  return false
}

// Check if user can delete a specific product
const canDeleteProduct = (product: Product) => {
  // Get user ID (handle both id and _id)
  const userId = authStore.user?.id || authStore.user?._id

  // If no user is logged in, can't delete
  if (!authStore.user || !userId) return false

  // Superadmins can delete any product
  if (authStore.isSuperAdmin()) return true

  // Check if user is the creator of the product
  if (product.createdBy && product.createdBy.user) {
    const creatorId =
      typeof product.createdBy.user === 'object'
        ? product.createdBy.user._id
        : product.createdBy.user
    if (creatorId === userId) return true
  }

  return false
}

const resetForm = () => {
  newProduct.value = {
    name: '',
    description: '',
    categoryId: '',
    brandId: '',
    supplierId: '',
    unit: '',
    currentStock: '',
    specifications: [{ name: '', value: '' }],
    images: null,
    sku: '',
    barcodeText: '',
    hasSerialNumbers: false,
    serialNumbersText: '',
    hasAssetControlNumber: false,
    assetControlNumbersText: ''
  }
  computerSpecs.value = {
    processor: '',
    storage: '',
    ram: '',
    videoCard: '',
    psu: '',
    motherboard: ''
  }
  isEditing.value = false
  editingProduct.value = null
}
// Update CRUD functions

const handleEditProduct = async (product: Product) => {
  isEditing.value = true
  try {
    // Fetch freshest product details to ensure serial numbers are available
    const { data } = await axios.get(`http://localhost:5000/api/products/${product._id}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const fullProduct: Product = (data && (data.product || data)) || product
    editingProduct.value = fullProduct

    const hasSerials = !!fullProduct.hasSerialNumbers
    const serialsText = Array.isArray(fullProduct.serialNumbers)
      ? fullProduct.serialNumbers.join('\n')
      : ''
    const hasACN = !!(fullProduct as any).hasAssetControlNumber
    const acnText = Array.isArray((fullProduct as any).assetControlNumbers)
      ? (fullProduct as any).assetControlNumbers.join('\n')
      : ''

    const existingSpecs = (fullProduct as any).specifications || []

    newProduct.value = {
      name: fullProduct.name,
      description: fullProduct.description,
      categoryId: (fullProduct as any).category?._id || '',
      brandId: (fullProduct as any).brand?._id || '',
      supplierId: (fullProduct as any).supplier?._id || '',
      unit: fullProduct.unit,
      currentStock:
        fullProduct.currentStock !== undefined && fullProduct.currentStock !== null
          ? String(fullProduct.currentStock)
          : '',
      specifications: existingSpecs.length > 0 ? existingSpecs : [{ name: '', value: '' }],
      images: null, // Set to null for editing since we don't handle image updates in edit mode
      sku: fullProduct.sku || '',
      barcodeText: fullProduct.barcode?.text || '',
      hasSerialNumbers: hasSerials,
      serialNumbersText: serialsText,
      hasAssetControlNumber: hasACN,
      assetControlNumbersText: acnText
    }
  } catch (error: any) {
    // Fallback to existing product data if request fails
    editingProduct.value = product
    const fallbackSpecs = (product as any).specifications || []

    newProduct.value = {
      name: product.name,
      description: product.description,
      categoryId: product.category?._id || '',
      brandId: product.brand?._id || '',
      supplierId: product.supplier?._id || '',
      unit: product.unit,
      currentStock:
        product.currentStock !== undefined && product.currentStock !== null
          ? String(product.currentStock)
          : '',
      specifications: fallbackSpecs.length > 0 ? fallbackSpecs : [{ name: '', value: '' }],
      images: null,
      sku: product.sku || '',
      barcodeText: product.barcode?.text || '',
      hasSerialNumbers: !!product.hasSerialNumbers,
      serialNumbersText: Array.isArray(product.serialNumbers)
        ? product.serialNumbers!.join('\n')
        : '',
      hasAssetControlNumber: !!(product as any).hasAssetControlNumber,
      assetControlNumbersText: Array.isArray((product as any).assetControlNumbers)
        ? ((product as any).assetControlNumbers as string[]).join('\n')
        : ''
    }
  }
  showModal.value = true
}

const handleViewProduct = async (product: Product) => {
  try {
    const { data } = await axios.get(`http://localhost:5000/api/products/${product._id}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    detailsProduct.value = (data && (data.product || data)) || product
  } catch (_) {
    detailsProduct.value = product
  }
  showDetailsModal.value = true
}
const handleUpdateProduct = async () => {
  try {
    isSubmitting.value = true
    // Build payload as JSON, including serial number fields
    const payload: any = { ...newProduct.value }
    if (payload.hasSerialNumbers) {
      payload.serialNumbers = payload.serialNumbersText || ''
    }
    // Include ACN fields when enabled
    if (payload.hasAssetControlNumber) {
      payload.assetControlNumbers = payload.assetControlNumbersText || ''
    }

    // Client-side check: serials must not exceed stock
    if (payload.hasSerialNumbers) {
      const stock = parseInt(payload.currentStock) || 0
      const count = parsedSerials.value.length
      if (count > stock) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Serials',
          text: `Serial numbers count (${count}) exceeds current stock (${stock}). Reduce serials or increase stock.`,
          customClass: {
            confirmButton:
              'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
          }
        })
        isSubmitting.value = false
        return
      }
    }
    const response = await axios.put(
      `http://localhost:5000/api/products/${editingProduct.value!._id}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    // Update local state
    products.value = products.value.map((product) =>
      product._id === editingProduct.value!._id ? response.data.product : product
    )

    // Emit socket event
    socket.emit('updateProduct', response.data.product)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Product updated successfully',
      timer: 1500
    })
  } catch (error: any) {
    let errorMessage = 'Error updating product'

    if (error.response?.status === 403) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    }

    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage,
      customClass: {
        confirmButton:
          'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
      }
    })
  } finally {
    isSubmitting.value = false
  }
}
const handleDeleteProduct = async (productId: string) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      selectedProductId.value = productId
      await axios.delete(`http://localhost:5000/api/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Update local state immediately
      products.value = products.value.filter((product) => product._id !== productId)
      socket.emit('deleteProduct', productId)

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Product has been deleted.',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (error: any) {
      let errorMessage = 'Error deleting item'

      if (error.response?.status === 403) {
        errorMessage = error.response.data.message
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      }

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage,
        customClass: {
          confirmButton:
            'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
        }
      })
    } finally {
      isDeleting.value = false
      selectedProductId.value = null
    }
  }
}

const handleToggleStatus = async (productId: string, currentStatus: boolean) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Product?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this product?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/products/${productId}/toggle-status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      // Update local state
      products.value = products.value.map((product) =>
        product._id === productId ? { ...product, isActive: !currentStatus } : product
      )

      // Emit socket event
      socket.emit('updateProduct', response.data.product)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Product ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1000,
        showConfirmButton: false
      })
    }
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error toggling product status'
    })
  }
}
const handleAddProduct = async () => {
  try {
    isSubmitting.value = true
    const formData = new FormData()

    // Clone newProduct to avoid modifying reactive state
    const productToSend = { ...newProduct.value }

    // Client-side check: serials must not exceed stock
    if (productToSend.hasSerialNumbers) {
      const stock = parseInt(productToSend.currentStock) || 0
      const count = parsedSerials.value.length
      if (count > stock) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Serials',
          text: `Serial numbers count (${count}) exceeds current stock (${stock}). Reduce serials or increase stock.`,
          customClass: {
            confirmButton:
              'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90'
          }
        })
        isSubmitting.value = false
        return
      }
    }

    // Only append SKU and barcodeText if they exist
    if (!productToSend.sku) delete productToSend.sku
    if (!productToSend.barcodeText)
      delete productToSend.barcodeText

      // Handle simple fields (string/number)
    ;[
      'name',
      'description',
      'categoryId',
      'brandId',
      'supplierId',
      'unit',
      'currentStock',
      'sku',
      'barcodeText'
    ].forEach((key) => {
      const value = (productToSend as any)[key]
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value)
      }
    })

    // Append serials-related fields
    formData.append('hasSerialNumbers', String(productToSend.hasSerialNumbers))
    if (productToSend.hasSerialNumbers && productToSend.serialNumbersText) {
      formData.append('serialNumbers', productToSend.serialNumbersText)
    }

    // Append ACN-related fields
    formData.append('hasAssetControlNumber', String(productToSend.hasAssetControlNumber))
    if (productToSend.hasAssetControlNumber && productToSend.assetControlNumbersText) {
      formData.append('assetControlNumbers', productToSend.assetControlNumbersText)
    }

    // Append specifications as JSON string
    formData.append('specifications', JSON.stringify(productToSend.specifications || []))

    // Append image if present
    if (productToSend.images) {
      formData.append('images', productToSend.images)
    }

    // Make POST request
    const response = await axios.post('http://localhost:5000/api/products', formData, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
        'Content-Type': 'multipart/form-data'
      }
    })

    products.value = [response.data.product, ...products.value]
    socket.emit('createProduct', response.data.product)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Product created successfully',
      timer: 1500
    })
  } catch (error: any) {
    console.error('Product creation error:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating product'
    })
  } finally {
    isSubmitting.value = false
  }
}

// Update socket listeners
onMounted(() => {
  fetchProducts()
  fetchCategories()
  fetchSuppliers()
  fetchSubCategories()
  fetchBrands()
  fetchNextItemId()

  socket.on('productUpdated', (updatedProduct) => {
    if (updatedProduct && updatedProduct._id) {
      products.value = products.value.map((product) =>
        product._id === updatedProduct._id ? updatedProduct : product
      )
    }
  })

  socket.on('productDeleted', (productId) => {
    if (productId) {
      products.value = products.value.filter((product) => product._id !== productId)
    }
  })
  return () => {
    socket.off('productCreated')
    socket.off('productUpdated')
    socket.off('productDeleted')
  }
})
// Auto-add required specifications when category changes
watch(
  () => newProduct.value.categoryId,
  () => {
    if (isComputerDesktop.value) {
      const requiredSpecs = [
        { name: 'Processor', value: '' },
        { name: 'Storage', value: '' },
        { name: 'RAM', value: '' },
        { name: 'Video Card', value: '' },
        { name: 'PSU', value: '' },
        { name: 'Motherboard', value: '' }
      ]

      // Remove existing computer specs to avoid duplicates
      newProduct.value.specifications = newProduct.value.specifications.filter(
        (spec) =>
          !['processor', 'storage', 'ram', 'video card', 'psu', 'motherboard'].includes(
            spec.name?.toLowerCase()
          )
      )

      // Add required specs at the beginning
      newProduct.value.specifications = [...requiredSpecs, ...newProduct.value.specifications]

      // Reset computer specs form
      computerSpecs.value = {
        processor: '',
        storage: '',
        ram: '',
        videoCard: '',
        psu: '',
        motherboard: ''
      }
    }
  }
)

watch(
  () => filters.value.priceRange,
  (newValue) => {
    if (newValue !== 'custom') {
      filters.value.minPrice = 0
      filters.value.maxPrice = 0
    }
  }
)
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="p-4 md:p-6 xl:p-7.5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h4 class="text-xl font-bold text-black dark:text-white">Item List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search Item..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 outline-none focus:border-primary dark:border-strokedark"
            />
            <span class="absolute left-4 top-1/2 -translate-y-1/2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 fill-current text-bodydark2"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </div>

          <button
            v-if="authStore.hasPermission('export_reports')"
            @click="exportProductsPDF"
            class="inline-flex items-center justify-center rounded-lg bg-success px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90 mr-2"
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

          <!-- Create Product button -->
          <button
            v-if="authStore.hasPermission('manage_products')"
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Create Item
          </button>
        </div>
      </div>
    </div>
    <div class="border-b border-stroke dark:border-strokedark">
      <div class="p-4 flex flex-wrap items-center gap-4">
        <!-- Category Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Category</label>
          <select
            v-model="filters.categoryId"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category._id" :value="category._id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Status</label>
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <!-- Price Range Filter -->
        <!-- <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white"
            >Price Range</label
          >
          <select
            v-model="filters.priceRange"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Prices</option>
            <option value="under1000">Under ₱1,000</option>
            <option value="1000to5000">₱1,000 - ₱5,000</option>
            <option value="over5000">Over ₱5,000</option>
            <option value="custom">Custom Range</option>
          </select>
        </div> -->

        <!-- Clear Filters Button -->
        <div class="flex items-end pt-6">
          <button
            @click="
              filters = { categoryId: '', status: '', priceRange: '', minPrice: 0, maxPrice: 0 }
            "
            class="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Custom Price Range -->
      <div v-if="filters.priceRange === 'custom'" class="px-4 pb-4 grid grid-cols-2 gap-4 max-w-lg">
        <div>
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Min Price</label>
          <input
            v-model.number="filters.minPrice"
            type="number"
            min="0"
            placeholder="₱0"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Max Price</label>
          <input
            v-model.number="filters.maxPrice"
            type="number"
            min="0"
            placeholder="₱999999"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
      </div>
    </div>
    <!-- Table -->
    <div class="max-w-full overflow-x-auto">
      <table class="w-full table-auto">
        <!-- Update the table headers -->
        <thead>
          <tr class="bg-gray-2 text-left dark:bg-meta-4">
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Item Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Barcode</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Category</th>
            <!-- <th class="py-4.5 px-4 font-medium text-black dark:text-white">SubCategory</th> -->
            <!-- <th class="py-4.5 px-4 font-medium text-black dark:text-white">Price</th> -->
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Stock</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Created By</th>
            <th
              class="py-4.5 px-4 font-medium text-black dark:text-white"
              v-if="authStore.canPerform('edit_product')"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="9" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedProducts.length === 0">
            <td colspan="9" class="text-center py-4">No products found</td>
          </tr>
          <tr
            v-for="product in paginatedProducts"
            :key="product._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  <img
                    v-if="
                      Array.isArray(product.images) &&
                      product.images.length &&
                      product.images[0].url
                    "
                    :src="product.images[0].url"
                    class="h-10 w-10 rounded-full object-cover"
                  />
                  <img
                    v-else-if="typeof product.images === 'string' && product.images"
                    :src="product.images"
                    class="h-10 w-10 rounded-full object-cover"
                  />
                  <span v-else>{{ product.name.charAt(0).toUpperCase() }}</span>
                </div>
                <p class="text-black dark:text-white">{{ product.name }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ product.barcode?.text }}</td>
            <td class="py-4.5 px-4">{{ product.category?.name || 'Not Assigned' }}</td>
            <!-- <td class="py-4.5 px-4">{{ product.subCategory?.name || 'Not Assigned' }}</td> -->
            <!-- <td class="py-4.5 px-4">{{ formatPrice(product.price) }}</td> -->
            <td class="py-4.5 px-4">{{ product.currentStock }} {{ product.unit }}</td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <div
                  :class="`h-3 w-3 rounded-full ${
                    product.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                  }`"
                ></div>
                <button
                  :class="`text-sm font-medium ${
                    product.isActive
                      ? 'text-success hover:text-meta-5'
                      : 'text-danger hover:text-meta-8'
                  }`"
                >
                  {{ product.isActive ? 'Active' : 'Inactive' }}
                </button>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {{
                    product.createdBy?.user && typeof product.createdBy.user === 'object'
                      ? `${product.createdBy.user.firstName} ${product.createdBy.user.lastName}`
                      : product.createdBy?.role || 'Unknown'
                  }}
                </span>
                <span
                  v-if="
                    authStore.user &&
                    (authStore.user.id || authStore.user._id) &&
                    product.createdBy &&
                    product.createdBy.user &&
                    ((typeof product.createdBy.user === 'object' &&
                      product.createdBy.user._id === (authStore.user.id || authStore.user._id)) ||
                      (typeof product.createdBy.user === 'string' &&
                        product.createdBy.user === (authStore.user.id || authStore.user._id)))
                  "
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary bg-opacity-10 text-primary"
                >
                  You
                </span>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button
                  v-if="authStore.hasPermission('view_products')"
                  @click="handleViewProduct(product)"
                  class="hover:text-primary"
                  title="View details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12a5 5 0 110-10 5 5 0 010 10z"
                    />
                  </svg>
                </button>
                <button
                  v-if="authStore.hasPermission('manage_products') && canEditProduct(product)"
                  @click="handleEditProduct(product)"
                  class="hover:text-primary"
                  :title="
                    authStore.user &&
                    (authStore.user.id || authStore.user._id) &&
                    product.createdBy &&
                    product.createdBy.user &&
                    ((typeof product.createdBy.user === 'object' &&
                      product.createdBy.user._id === (authStore.user.id || authStore.user._id)) ||
                      (typeof product.createdBy.user === 'string' &&
                        product.createdBy.user === (authStore.user.id || authStore.user._id)))
                      ? 'Edit your item'
                      : 'Edit item (Super Admin)'
                  "
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                    />
                  </svg>
                </button>
                <span
                  v-else-if="authStore.hasPermission('manage_products') && !canEditProduct(product)"
                  class="text-gray-400 cursor-not-allowed"
                  title="You can only edit products that you created"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                    />
                  </svg>
                </span>
                <button
                  v-if="authStore.hasPermission('delete_products') && canDeleteProduct(product)"
                  @click="handleDeleteProduct(product._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedProductId === product._id"
                  :title="
                    authStore.user &&
                    (authStore.user.id || authStore.user._id) &&
                    product.createdBy &&
                    product.createdBy.user &&
                    ((typeof product.createdBy.user === 'object' &&
                      product.createdBy.user._id === (authStore.user.id || authStore.user._id)) ||
                      (typeof product.createdBy.user === 'string' &&
                        product.createdBy.user === (authStore.user.id || authStore.user._id)))
                      ? 'Delete your product'
                      : 'Delete product (Super Admin)'
                  "
                >
                  <svg
                    v-if="!(isDeleting && selectedProductId === product._id)"
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
                  <svg
                    v-else
                    class="animate-spin h-5 w-5"
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
                </button>
                <span
                  v-else-if="
                    authStore.hasPermission('delete_products') && !canDeleteProduct(product)
                  "
                  class="text-gray-400 cursor-not-allowed"
                  title="You can only delete products that you created"
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
                </span>
              </div>
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
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div
        class="relative max-h-[85%] overflow-auto w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark"
      >
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">
            {{ isEditing ? 'Update Item' : 'Create Item' }}
          </h3>
          <button
            @click="
              () => {
                handleCloseModal()
              }
            "
            class="hover:text-danger"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!--  s Navigation -->

        <form
          v-if="authStore.hasPermission('manage_products')"
          @submit.prevent="isEditing ? handleUpdateProduct() : handleAddProduct()"
          class="space-y-6"
        >
          <div class="grid grid-cols-2 gap-4">
            <!-- Product Name -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Item Name <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.name"
                type="text"
                required
                placeholder="Enter item name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Description <span class="text-danger">*</span>
              </label>
              <textarea
                v-model="newProduct.description"
                required
                placeholder="Enter product description"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              ></textarea>
            </div>

            <!-- Category -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Category <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.categoryId"
                required
                :disabled="isFetchingCategories"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>
                  {{ isFetchingCategories ? 'Loading...' : 'Select a category' }}
                </option>
                <option v-for="category in categories" :key="category._id" :value="category._id">
                  {{ category.name }}
                </option>
              </select>
            </div>

            <!-- Brand -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Brand <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.brandId"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a brand</option>
                <option v-for="brand in brands" :key="brand._id" :value="brand._id">
                  {{ brand.name }}
                </option>
              </select>
            </div>

            <!-- Supplier -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Supplier <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.supplierId"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a supplier</option>
                <option v-for="supplier in suppliers" :key="supplier._id" :value="supplier._id">
                  {{ supplier.name }}
                </option>
              </select>
            </div>

            <!-- Specifications -->
            <div class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white">Specifications</label>

              <!-- Regular Specifications -->
              <div class="space-y-3">
                <div
                  v-for="(spec, index) in newProduct.specifications"
                  :key="index"
                  class="flex gap-2 mb-2"
                >
                  <input
                    v-model="spec.name"
                    placeholder="Name"
                    class="w-1/2 rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                  <input
                    v-model="spec.value"
                    placeholder="Value"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                  <button
                    type="button"
                    class="px-3 py-2 rounded bg-danger text-white"
                    @click="newProduct.specifications.splice(index, 1)"
                  >
                    Remove
                  </button>
                </div>
                <button
                  type="button"
                  class="px-3 py-2 rounded bg-primary text-white"
                  @click="newProduct.specifications.push({ name: '', value: '' })"
                >
                  Add Additional Specification
                </button>
              </div>
            </div>

            <!-- Unit -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Unit <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.unit"
                required
                class="rounded w-full border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a unit</option>
                <option value="pieces">Pieces</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="liters">Liters</option>
                <option value="meters">Meters</option>
                <option value="boxes">Boxes</option>
              </select>
            </div>

            <!-- Current Stock -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Current Stock <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.currentStock"
                type="number"
                required
                min="0"
                placeholder="Enter current stock"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Serial Number Toggle -->
            <div class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white">Has Serial Numbers</label>
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  v-model="newProduct.hasSerialNumbers"
                  @change="handleSerialToggle"
                />
                <span class="text-sm text-bodydark"
                  >Enable if items require unique serials (automatically enables ACN)</span
                >
              </div>
            </div>

            <!-- Serial Numbers Textarea -->
            <div v-if="newProduct.hasSerialNumbers" class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white">Serial Numbers</label>
              <textarea
                v-model="newProduct.serialNumbersText"
                placeholder="Enter one serial per line, or comma-separated"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              ></textarea>
              <div class="mt-1 text-xs" :class="serialsError ? 'text-danger' : 'text-bodydark2'">
                Serials: {{ serialsCount }} of {{ currentStockNumber }} stock
              </div>
              <div v-if="serialsError" class="text-danger text-xs mt-1">{{ serialsError }}</div>
            </div>

            <!-- ACN Toggle -->
            <div class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white"
                >Has Asset Control Number (ACN)</label
              >
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  v-model="newProduct.hasAssetControlNumber"
                  :disabled="newProduct.hasSerialNumbers"
                />
                <span class="text-sm text-bodydark">
                  {{
                    newProduct.hasSerialNumbers
                      ? 'Automatically enabled (required for serialized items)'
                      : 'Enable if items have ACNs to track'
                  }}
                </span>
              </div>
            </div>

            <!-- ACN Textarea -->
            <div v-if="newProduct.hasAssetControlNumber" class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white"
                >Asset Control Numbers (ACN)</label
              >
              <div
                v-if="newProduct.hasSerialNumbers"
                class="mb-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800"
              >
                <strong>Auto-generation:</strong> ACNs will be automatically generated for each
                serial number ({{ serialsCount }} ACNs will be created).
              </div>
              <div v-else>
                <textarea
                  v-model="newProduct.assetControlNumbersText"
                  placeholder="Enter ACNs (one per line or comma-separated). Leave empty to auto-generate one ACN."
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                ></textarea>
                <div class="mt-1 text-xs text-bodydark2">
                  {{
                    acnInfo ||
                    'For non-serialized items: Provide custom ACNs or leave empty to auto-generate one ACN for the entire item.'
                  }}
                </div>
              </div>
            </div>

            <!-- Item ID (readonly) -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white"> Item ID </label>
              <input
                :value="nextItemId"
                readonly
                class="w-full rounded border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input"
              />
              <div class="text-xs text-bodydark2 mt-1">
                Used for ACN generation (format: XXX-###-YY-###)
              </div>
            </div>

            <!-- SKU -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                SKU <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.sku"
                type="number"
                placeholder="Enter product SKU"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
              <div v-if="skuError" class="text-danger text-xs mt-1">{{ skuError }}</div>
            </div>

            <!-- Barcode -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white"> Barcode </label>
              <input
                v-model="newProduct.barcodeText"
                type="number"
                placeholder="Enter product barcode"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
              <div v-if="barcodeError" class="text-danger text-xs mt-1">{{ barcodeError }}</div>
            </div>
            <div v-if="!isEditing" class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white">
                Product Image <span class="text-danger">*</span>
              </label>
              <div class="flex items-center gap-4">
                <input
                  type="file"
                  @change="handleImageChange"
                  accept="image/*"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
                <img
                  v-if="imagePreview"
                  :src="imagePreview"
                  class="h-20 w-20 object-cover rounded"
                />
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="flex justify-end gap-4">
            <button
              type="button"
              @click="
                () => {
                  handleCloseModal()
                }
              "
              class="rounded border border-stroke px-6 py-2 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90 disabled:opacity-50"
              :disabled="
                isSubmitting || (newProduct.hasSerialNumbers && serialsCount > currentStockNumber)
              "
            >
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Details Modal -->
    <div
      v-if="showDetailsModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div
        class="relative max-h-[85%] overflow-auto w-full max-w-3xl rounded-lg bg-white p-6 dark:bg-boxdark"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Product Details</h3>
          <button @click="showDetailsModal = false" class="hover:text-danger">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div v-if="detailsProduct" class="space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-bodydark2">Name</div>
              <div class="font-medium">{{ detailsProduct.name }}</div>
            </div>
            <div>
              <div class="text-sm text-bodydark2">SKU</div>
              <div class="font-medium">{{ detailsProduct.sku || '—' }}</div>
            </div>
            <div>
              <div class="text-sm text-bodydark2">Barcode</div>
              <div class="font-medium">{{ detailsProduct.barcode?.text || '—' }}</div>
            </div>
            <div>
              <div class="text-sm text-bodydark2">Stock</div>
              <div class="font-medium">
                {{ detailsProduct.currentStock }} {{ detailsProduct.unit }}
              </div>
            </div>
            <div>
              <div class="text-sm text-bodydark2">Category</div>
              <div class="font-medium">
                {{ (detailsProduct as any).category?.name || 'Not Assigned' }}
              </div>
            </div>
            <div>
              <div class="text-sm text-bodydark2">Supplier</div>
              <div class="font-medium">{{ (detailsProduct as any).supplier?.name || '—' }}</div>
            </div>
          </div>

          <div>
            <div class="text-sm text-bodydark2">Description</div>
            <div class="font-medium whitespace-pre-line">
              {{ detailsProduct.description || '—' }}
            </div>
          </div>

          <div>
            <div class="text-sm text-bodydark2">Has Serials</div>
            <div class="font-medium">{{ detailsProduct.hasSerialNumbers ? 'Yes' : 'No' }}</div>
          </div>

          <div v-if="detailsProduct.hasSerialNumbers" class="mt-2">
            <div class="flex items-center justify-between">
              <div class="text-sm text-bodydark2">Serial Numbers</div>
              <div class="text-xs text-bodydark2">
                {{ (detailsProduct.serialNumbers && detailsProduct.serialNumbers.length) || 0 }}
                total
              </div>
            </div>
            <div
              class="mt-2 max-h-64 overflow-auto rounded border border-stroke p-3 text-sm dark:border-strokedark"
            >
              <ul class="list-disc pl-5">
                <li v-for="s in detailsProduct.serialNumbers || []" :key="s">{{ s }}</li>
              </ul>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              @click="showDetailsModal = false"
              class="rounded border border-stroke px-6 py-2 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
