<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import Swal from 'sweetalert2'
import { useRouter } from 'vue-router'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

const authStore = useAuthStore()
const router = useRouter()

// Data
const products = ref([])
const selectedProducts = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const isGenerating = ref(false)
const isPrinting = ref(false)

// Fetch all products
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/products/', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to fetch products'
    })
  } finally {
    isLoading.value = false
  }
}

// Filter products based on search query
const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value
  const query = searchQuery.value.toLowerCase()
  return products.value.filter(
    (product) =>
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      (product.barcode?.text && product.barcode.text.toLowerCase().includes(query))
  )
})

// Toggle product selection
const toggleProductSelection = (productId) => {
  const index = selectedProducts.value.indexOf(productId)
  if (index === -1) {
    selectedProducts.value.push(productId)
  } else {
    selectedProducts.value.splice(index, 1)
  }
}

// Select all products
const selectAllProducts = () => {
  if (selectedProducts.value.length === filteredProducts.value.length) {
    selectedProducts.value = []
  } else {
    selectedProducts.value = filteredProducts.value.map((product) => product._id)
  }
}

// Generate barcode for a single product
const generateBarcode = async (productId) => {
  try {
    isGenerating.value = true
    const response = await axios.get(`http://localhost:5000/api/barcodes/generate/${productId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      responseType: 'blob'
    })

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `barcode-${productId}.png`)
    document.body.appendChild(link)
    link.click()
    link.remove()

    // Update product in the list
    await fetchProducts()

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Barcode generated successfully',
      timer: 1500
    })
  } catch (error) {
    console.error('Error generating barcode:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to generate barcode'
    })
  } finally {
    isGenerating.value = false
  }
}

// Batch generate barcodes for selected products
const batchGenerateBarcodes = async () => {
  if (selectedProducts.value.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'No Products Selected',
      text: 'Please select at least one product'
    })
    return
  }

  try {
    isGenerating.value = true
    const response = await axios.post(
      'http://localhost:5000/api/barcodes/batch',
      { productIds: selectedProducts.value },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    // Update products list
    await fetchProducts()

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: `Generated ${response.data.results.length} barcodes successfully`
    })
  } catch (error) {
    console.error('Error batch generating barcodes:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to generate barcodes'
    })
  } finally {
    isGenerating.value = false
  }
}

// Print barcode for a single product
const printBarcode = async (productId) => {
  try {
    isPrinting.value = true
    const response = await axios.get(`http://localhost:5000/api/barcodes/product/${productId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    const printData = response.data.printData

    // Create PDF with standard dimensions (in mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [60, 40] // Standard small label size (60mm x 40mm)
    })

    // Set margins and positions
    const margin = 5
    const width = 50 // Width of content area
    const barcodeHeight = 15 // Standard height for retail barcodes

    // Add product name (truncate if too long)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    const name =
      printData.productInfo.name.length > 25
        ? printData.productInfo.name.substring(0, 22) + '...'
        : printData.productInfo.name
    doc.text(name, 30, margin + 4, { align: 'center' })

    // Add SKU and price
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`SKU: ${printData.productInfo.sku}`, 30, margin + 8, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    // Improved price formatting with better error handling
    const rawPrice = printData.productInfo?.price;
    const cleanedPrice = typeof rawPrice === 'string'
      ? rawPrice.replace(/[^\d.-]/g, '')
      : rawPrice;
    
    const numericPrice = Number(cleanedPrice);
    const priceText = Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : '0.00';
    
    doc.text(`Price: P${priceText}`, 30, margin + 12, { align: 'center' })

    // Add barcode image with standard dimensions
    const imgData = `data:image/png;base64,${printData.barcodeImage}`
    doc.addImage(imgData, 'PNG', margin, margin + 14, width, barcodeHeight)

    // Add barcode text
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(printData.barcodeText, 30, margin + 32, { align: 'center' })

    // Print the PDF
    doc.autoPrint()
    doc.output('dataurlnewwindow')
  } catch (error) {
    console.error('Error printing barcode:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to print barcode'
    })
  } finally {
    isPrinting.value = false
  }
}



// Print barcode with quantity option
const printBarcodeWithQuantity = async (productId) => {
  try {
    const { value: quantity } = await Swal.fire({
      title: 'Print Multiple Copies',
      input: 'number',
      inputLabel: 'How many copies do you want to print?',
      inputValue: 1,
      inputAttributes: {
        min: 1,
        max: 100,
        step: 1
      },
      showCancelButton: true,
      confirmButtonText: 'Print',
      inputValidator: (value) => {
        if (!value || value < 1) {
          return 'Please enter a valid quantity (minimum 1)'
        }
      }
    })
    
    if (quantity) {
      isPrinting.value = true
      const response = await axios.get(`http://localhost:5000/api/barcodes/product/${productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      const printData = response.data.printData
      
      // Create PDF with A4 size for multiple copies
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      // Define layout constants
      const pageWidth = 210
      const pageHeight = 297
      const labelWidth = 60
      const labelHeight = 40
      const barcodeHeight = 15
      const marginX = 10
      const marginY = 10
      const colGap = 5
      const rowGap = 5
      
      // Calculate columns and rows
      const cols = Math.floor((pageWidth - 2 * marginX) / (labelWidth + colGap))
      const rows = Math.floor((pageHeight - 2 * marginY) / (labelHeight + rowGap))
      const labelsPerPage = cols * rows
      
      for (let i = 0; i < quantity; i++) {
        // Add a new page if needed
        if (i > 0 && i % labelsPerPage === 0) {
          doc.addPage()
        }
        
        // Calculate position
        const positionOnPage = i % labelsPerPage
        const row = Math.floor(positionOnPage / cols)
        const col = positionOnPage % cols
        
        const x = marginX + col * (labelWidth + colGap)
        const y = marginY + row * (labelHeight + rowGap)
        
        // Draw label border
        doc.setDrawColor(200, 200, 200)
        doc.rect(x, y, labelWidth, labelHeight)
        
        // Add product name (truncate if too long)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        const name =
          printData.productInfo.name.length > 25
            ? printData.productInfo.name.substring(0, 22) + '...'
            : printData.productInfo.name
        doc.text(name, x + labelWidth / 2, y + 4, { align: 'center' })
        
        // Add SKU and price
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(`SKU: ${printData.productInfo.sku}`, x + labelWidth / 2, y + 8, { align: 'center' })
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        
        // Improved price formatting
        const rawPrice = printData.productInfo?.price;
        const cleanedPrice = typeof rawPrice === 'string'
          ? rawPrice.replace(/[^\d.-]/g, '')
          : rawPrice;
        
        const numericPrice = Number(cleanedPrice);
        const priceText = Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : '0.00';
        
        doc.text(`Price: P${priceText}`, x + labelWidth / 2, y + 12, { align: 'center' })
        
        // Add barcode image
        const imgData = `data:image/png;base64,${printData.barcodeImage}`
        doc.addImage(imgData, 'PNG', x + 5, y + 14, labelWidth - 10, barcodeHeight)
        
        // Add barcode text
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(printData.barcodeText, x + labelWidth / 2, y + 32, { align: 'center' })
      }
      
      // Print the PDF
      doc.autoPrint()
      doc.output('dataurlnewwindow')
    }
  } catch (error) {
    console.error('Error printing barcodes:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to print barcodes'
    })
  } finally {
    isPrinting.value = false
  }
}

// Export a single barcode as PNG
const exportBarcode = async (productId) => {
  try {
    isPrinting.value = true
    const response = await axios.get(`http://localhost:5000/api/barcodes/product/${productId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    const printData = response.data.printData
    
    // Create a download link for the PNG
    const productName = printData.productInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const fileName = `${productName}_${printData.productInfo.sku}.png`
    
    // Create a download link
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${printData.barcodeImage}`
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Barcode exported successfully',
      timer: 1500
    })
  } catch (error) {
    console.error('Error exporting barcode:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to export barcode'
    })
  } finally {
    isPrinting.value = false
  }
}

// Export multiple barcodes as preview images
const exportMultipleBarcodes = async () => {
  if (selectedProducts.value.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'No Products Selected',
      text: 'Please select at least one product'
    });
    return;
  }

  try {
    isPrinting.value = true;

    // Fetch all barcode data first
    const barcodeDataPromises = selectedProducts.value.map(productId => 
      axios.get(`http://localhost:5000/api/barcodes/product/${productId}`, {
        headers: { Authorization: `Bearer ${authStore.token}` }
      })
    );
    
    const barcodeResponses = await Promise.all(barcodeDataPromises);
    const barcodeDataList = barcodeResponses.map(response => response.data.printData);

    // Create a zip file to store all the barcode preview images
    const JSZip = await import('jszip').then(module => module.default);
    const zip = new JSZip();
    
    // Process each barcode
    const processPromises = barcodeDataList.map(async (printData) => {
      return new Promise((resolve, reject) => {
        try {
          // Format price consistently
          const rawPrice = printData.productInfo?.price;
          const cleanedPrice = typeof rawPrice === 'string'
            ? rawPrice.replace(/[^\d.-]/g, '')
            : rawPrice;
          
          const numericPrice = Number(cleanedPrice);
          const priceText = Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : '0.00';
          
          // Create a canvas to draw the barcode preview
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set canvas dimensions
          canvas.width = 600;
          canvas.height = 400;
          
          // Fill background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Add border
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 2;
          ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
          
          // Add product name
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          
          const name = printData.productInfo.name.length > 25
            ? printData.productInfo.name.substring(0, 22) + '...'
            : printData.productInfo.name;
          
          ctx.fillText(name, canvas.width / 2, 50);
          
          // Add SKU
          ctx.font = '18px Arial';
          ctx.fillText(`SKU: ${printData.productInfo.sku}`, canvas.width / 2, 80);
          
          // Add price
          ctx.font = 'bold 20px Arial';
          ctx.fillText(`Price: P${priceText}`, canvas.width / 2, 110);
          
          // Add barcode image
          const img = new Image();
          img.onload = () => {
            // Draw barcode image
            const barcodeWidth = 500;
            const barcodeHeight = 150;
            const barcodeX = (canvas.width - barcodeWidth) / 2;
            const barcodeY = 130;
            
            ctx.drawImage(img, barcodeX, barcodeY, barcodeWidth, barcodeHeight);
            
            // Add barcode text
            ctx.font = '16px Arial';
            ctx.fillText(printData.barcodeText, canvas.width / 2, 320);
            
            // Convert canvas to PNG and add to zip
            const productName = printData.productInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `${productName}_${printData.productInfo.sku}_label.png`;
            
            canvas.toBlob((blob) => {
              zip.file(fileName, blob);
              resolve();
            });
          };
          
          img.onerror = () => {
            console.error('Error loading barcode image');
            reject(new Error('Failed to load barcode image'));
          };
          
          img.src = `data:image/png;base64,${printData.barcodeImage}`;
        } catch (error) {
          reject(error);
        }
      });
    });
    
    // Wait for all barcodes to be processed
    await Promise.all(processPromises);
    
    // Generate the zip file
    const content = await zip.generateAsync({type: 'blob'});
    
    // Create a download link
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'barcode_labels.zip');
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: `Exported ${barcodeDataList.length} barcode labels successfully`,
      timer: 2000
    });
  } catch (error) {
    console.error('Error exporting barcode previews:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to export barcode previews'
    });
  } finally {
    isPrinting.value = false;
  }
}
// Print barcode for a single product
const previewBarcode = async (productId) => {
  try {
    const response = await axios.get(`http://localhost:5000/api/barcodes/product/${productId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    const printData = response.data.printData
    
    // Format price consistently with printing
    const rawPrice = printData.productInfo?.price;
    const cleanedPrice = typeof rawPrice === 'string'
      ? rawPrice.replace(/[^\d.-]/g, '')
      : rawPrice;
    
    const numericPrice = Number(cleanedPrice);
    const priceText = Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : '0.00';

    Swal.fire({
      title: printData.productInfo.name,
      html: `
        <div class="flex flex-col items-center">
          <p class="mb-2">SKU: ${printData.productInfo.sku}</p>
          <p class="mb-4">Price: P${priceText}</p>
          <img 
            src="data:image/png;base64,${printData.barcodeImage}" 
            alt="Barcode" 
            class="max-w-full h-auto mb-2"
          />
          <p class="text-xs">${printData.barcodeText}</p>
        </div>
      `,
      width: 400,
      showConfirmButton: false,
      showCloseButton: true
    })
  } catch (error) {
    console.error('Error previewing barcode:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to preview barcode'
    })
  }
}
onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="p-4 md:p-6 xl:p-7.5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h4 class="text-xl font-bold text-black dark:text-white">Barcode Management</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search or scan barcode..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 outline-none focus:border-primary dark:border-strokedark"
              @keyup.enter="findProductByBarcode"
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
            @click="findProductByBarcode"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Find Product
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Actions -->
    <div class="border-b border-stroke dark:border-strokedark">
      <div class="p-4 flex flex-wrap items-center gap-4">
        <button
          @click="selectAllProducts"
          class="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
          :class="{
            'bg-gray-100 dark:bg-meta-4': selectedProducts.length === filteredProducts.length
          }"
        >
          {{ selectedProducts.length === filteredProducts.length ? 'Deselect All' : 'Select All' }}
        </button>

        <!-- <button
          @click="batchGenerateBarcodes"
          :disabled="isGenerating || selectedProducts.length === 0"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
        >
          <span v-if="isGenerating">Generating...</span>
          <span v-else>Generate Selected Barcodes</span>
        </button> -->

      <!-- Replace the print button with export button -->
<button
  @click="exportMultipleBarcodes"
  :disabled="isPrinting || selectedProducts.length === 0"
  class="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
>
  <span v-if="isPrinting">Exporting...</span>
  <span v-else>Export Selected Barcodes</span>
</button>

        <div class="ml-auto">
          <span class="text-sm font-medium text-black dark:text-white">
            {{ selectedProducts.length }} of {{ filteredProducts.length }} selected
          </span>
        </div>
      </div>
    </div>

    <!-- Products Table -->
    <div class="p-4">
      <div class="max-w-full overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">
                <input
                  type="checkbox"
                  :checked="
                    selectedProducts.length === filteredProducts.length &&
                    filteredProducts.length > 0
                  "
                  @change="selectAllProducts"
                  class="h-5 w-5 cursor-pointer rounded border-gray-500 checked:bg-primary"
                />
              </th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Product</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">SKU</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Barcode</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Preview</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Price</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Stock</th>
              <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="py-5 text-center">
                <div class="flex justify-center">
                  <div
                    class="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
                  ></div>
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="7" class="py-5 text-center text-black dark:text-white">
                No products found
              </td>
            </tr>
            <tr
              v-for="product in filteredProducts"
              :key="product._id"
              class="border-b border-[#eee] dark:border-strokedark"
            >
              <td class="py-5 px-4">
                <input
                  type="checkbox"
                  :checked="selectedProducts.includes(product._id)"
                  @change="toggleProductSelection(product._id)"
                  class="h-5 w-5 cursor-pointer rounded border-gray-500 checked:bg-primary"
                />
              </td>
              <td class="py-5 px-4">
                <div class="flex items-center gap-3">
                  <div class="h-12 w-12 rounded-md overflow-hidden">
                    <img
                      v-if="product.images && product.images.length > 0"
                      :src="product.images[0].url"
                      alt="Product"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="h-full w-full bg-gray-200 dark:bg-meta-4 flex items-center justify-center"
                    >
                      <span class="text-xs text-gray-500 dark:text-gray-400">No image</span>
                    </div>
                  </div>
                  <h5 class="font-medium text-black dark:text-white">{{ product.name }}</h5>
                </div>
              </td>
              <td class="py-5 px-4">
                <p class="text-black dark:text-white">{{ product.sku }}</p>
              </td>
              <td class="py-5 px-4">
                <p
                  v-if="product.barcode && product.barcode.text"
                  class="text-black dark:text-white"
                >
                  {{ product.barcode.text }}
                </p>
                <p v-else class="text-gray-500 dark:text-gray-400">Not generated</p>
              </td>
              <td class="py-5 px-4">
                <div v-if="product.barcode && product.barcode.text" class="flex justify">
                  <button
                    @click="previewBarcode(product._id)"
                    class="inline-flex items-center justify-center rounded-md bg-primary bg-opacity-10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-opacity-20 transition-all duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5 mr-1"
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
                    View Barcode
                  </button>
                </div>
                <p v-else class="text-gray-500 dark:text-gray-400 text-center">No preview</p>
              </td>
              <td class="py-5 px-4">
                <p class="text-black dark:text-white">₱{{ product.price }}</p>
              </td>
              <td class="py-5 px-4">
                <p class="text-black dark:text-white">{{ product.currentStock }}</p>
              </td>
              <!-- <td class="py-5 px-4">
                <div class="flex items-center space-x-3.5">
                  <button
                    v-if="product.barcode && product.barcode.text"
                    @click="printBarcode(product._id)"
                    :disabled="isPrinting"
                    class="hover:text-primary"
                    title="Print Barcode"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button> -->

                  <!-- Show Generate button only for products without barcodes -->
                  <!-- <button
                    v-if="!product.barcode || !product.barcode.text"
                    @click="generateBarcode(product._id)"
                    :disabled="isGenerating"
                    class="hover:text-primary"
                    title="Generate Barcode"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm12 12V7H8v7a1 1 0 01-1 1H4V4h12v10z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button> -->

                  <!-- Add Regenerate button for products with existing barcodes -->
                  <!-- <button
                    v-if="product.barcode && product.barcode.text"
                    @click="generateBarcode(product._id)"
                    :disabled="isGenerating"
                    class="hover:text-warning"
                    title="Regenerate Barcode"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </td> -->
              <!-- In your table actions column -->
<td class="py-5 px-4">
  <div class="flex items-center space-x-2">
    <button
      v-if="product.barcode && product.barcode.text"
      @click="printBarcode(product._id)"
      class="inline-flex items-center justify-center rounded-md bg-success bg-opacity-10 px-3 py-1.5 text-xs font-medium text-success hover:bg-opacity-20 transition-all duration-200"
      :disabled="isPrinting"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd" />
      </svg>
      Print
    </button>
    <button
      v-if="product.barcode && product.barcode.text"
      @click="printBarcodeWithQuantity(product._id)"
      class="inline-flex items-center justify-center rounded-md bg-info bg-opacity-10 px-3 py-1.5 text-xs font-medium text-info hover:bg-opacity-20 transition-all duration-200"
      :disabled="isPrinting"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5z" />
        <path d="M11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      Multiple
    </button>
  </div>
</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
