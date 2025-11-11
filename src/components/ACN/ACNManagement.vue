<template>
  <div
    class="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1"
  >
    <div class="mb-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h4 class="text-xl font-semibold text-black dark:text-white mb-2">
            Asset Control Numbers (ACN)
          </h4>
          <div class="flex items-center gap-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Total:
              <span class="font-semibold text-black dark:text-white">{{
                filteredACNs.length
              }}</span>
              ACNs
            </p>
            <p v-if="selectedACNs.length > 0" class="text-sm text-primary">
              Selected: <span class="font-semibold">{{ selectedACNs.length }}</span>
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            @click="openGenerateModal"
            class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 transition"
          >
            + Generate ACN
          </button>
          <button
            @click="bulkPrint"
            :disabled="selectedACNs.length === 0"
            class="bg-success text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50 transition"
          >
            Print ({{ selectedACNs.length }})
          </button>
          <button
            @click="bulkDownload"
            :disabled="selectedACNs.length === 0"
            class="bg-warning text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50 transition"
          >
            Download ({{ selectedACNs.length }})
          </button>
          <button
            @click="fetchACNs"
            class="border border-stroke px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-meta-4 transition"
          >
            Refresh
          </button>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search ACNs, serials, products..."
          class="flex-1 rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white"
        />
        <BaseCombobox
          v-model="selectedProduct"
          :options="products"
          labelKey="name"
          valueKey="_id"
          placeholder="All Products"
          @update:modelValue="filterByProduct"
        />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
    </div>

    <div v-else-if="filteredACNs.length === 0" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400">No ACNs found</p>
    </div>

    <div v-else class="max-w-full overflow-x-auto">
      <table class="w-full table-auto">
        <thead>
          <tr class="bg-gray-2 text-left dark:bg-meta-4">
            <th class="py-4 px-4 font-medium text-black dark:text-white">
              <input
                type="checkbox"
                @change="toggleSelectAll"
                :checked="isAllSelected"
                class="rounded"
              />
            </th>
            <th class="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">ACN Code</th>
            <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">Product</th>
            <th class="min-w-[100px] py-4 px-4 font-medium text-black dark:text-white">
              Serial Number
            </th>
            <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">Barcode</th>
            <th class="min-w-[80px] py-4 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="min-w-[160px] py-4 px-4 font-medium text-black dark:text-white">Assigned To</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="acn in filteredACNs"
            :key="acn._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-5 px-4">
              <input type="checkbox" :value="acn._id" v-model="selectedACNs" class="rounded" />
            </td>
            <td class="py-5 px-4">
              <p class="text-black dark:text-white font-medium">{{ acn.acnCode }}</p>
            </td>
            <td class="py-5 px-4">
              <p class="text-black dark:text-white">{{ acn.product?.name || 'Unknown' }}</p>
              <p class="text-sm text-gray-500">{{ acn.product?.sku || 'NO_SKU' }}</p>
            </td>
            <td class="py-5 px-4">
              <p class="text-black dark:text-white">{{ acn.serialNumber || 'N/A' }}</p>
            </td>
            <td class="py-5 px-4">
              <div class="flex items-center gap-2">
                <button
                  @click="viewBarcode(acn)"
                  title="View Barcode"
                  class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-3 text-center text-xs font-medium text-white hover:bg-opacity-90"
                >
                  View
                </button>
                <button
                  @click="printBarcode(acn)"
                  title="Print Barcode"
                  class="inline-flex items-center justify-center rounded-md bg-success py-2 px-3 text-center text-xs font-medium text-white hover:bg-opacity-90"
                >
                  Print
                </button>
                <button
                  @click="downloadBarcode(acn)"
                  title="Download Barcode"
                  class="inline-flex items-center justify-center rounded-md bg-warning py-2 px-3 text-center text-xs font-medium text-white hover:bg-opacity-90"
                >
                  Download
                </button>
              </div>
            </td>
            <td class="py-5 px-4">
              <span
                :class="acn.isActive ? 'bg-success text-success' : 'bg-danger text-danger'"
                class="inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium"
              >
                {{ acn.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="py-5 px-4">
              <div v-if="assignmentStatus.acn[acn.acnCode]?.assigned" class="text-sm">
                <span class="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5">
                  {{ assignmentStatus.acn[acn.acnCode].endUserOrMR }} ({{ assignmentStatus.acn[acn.acnCode].department }})
                </span>
              </div>
              <div v-else-if="acn.serialNumber && assignmentStatus.serial[acn.serialNumber]?.assigned" class="text-sm">
                <span class="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5">
                  {{ assignmentStatus.serial[acn.serialNumber].endUserOrMR }} ({{ assignmentStatus.serial[acn.serialNumber].department }})
                </span>
              </div>
              <div v-else class="text-xs text-bodydark2">Unassigned</div>
            </td>
            <td class="py-5 px-4">
              <div class="flex items-center gap-2">
                <button
                  @click="editACN(acn)"
                  class="text-primary hover:text-opacity-80"
                  title="Edit ACN"
                >
                  Edit
                </button>
                <button
                  @click="toggleACNStatus(acn)"
                  :class="acn.isActive ? 'text-danger' : 'text-success'"
                  class="hover:text-opacity-80"
                  :title="acn.isActive ? 'Deactivate' : 'Activate'"
                >
                  {{ acn.isActive ? 'Deactivate' : 'Activate' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && filteredACNs.length > 0" class="flex items-center justify-between border-t border-stroke dark:border-strokedark px-5 py-4">
      <div class="text-sm text-bodydark2">
        Showing {{ (pagination.currentPage - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.currentPage * pagination.limit, pagination.totalItems) }} of {{ pagination.totalItems }} ACNs
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="goToPage(1)"
          :disabled="pagination.currentPage === 1"
          class="px-3 py-1 rounded border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          First
        </button>
        <button
          @click="goToPage(pagination.currentPage - 1)"
          :disabled="!pagination.hasPrev"
          class="px-3 py-1 rounded border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="px-3 py-1 text-sm font-medium">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
        <button
          @click="goToPage(pagination.currentPage + 1)"
          :disabled="!pagination.hasNext"
          class="px-3 py-1 rounded border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
        <button
          @click="goToPage(pagination.totalPages)"
          :disabled="pagination.currentPage === pagination.totalPages"
          class="px-3 py-1 rounded border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Last
        </button>
      </div>
    </div>

    <!-- Generate ACN Modal -->
    <div
      v-if="showGenerateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white dark:bg-boxdark rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-black dark:text-white">Generate ACNs</h3>
          <button @click="closeGenerateModal" class="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <form @submit.prevent="handleGenerate">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="text-sm font-semibold">Items ({{ items.length }})</h4>
            <button type="button" @click="addItem" class="text-primary text-sm hover:underline">+ Add Item</button>
          </div>

          <div v-for="(item, idx) in items" :key="idx" class="mb-4 p-4 border border-stroke dark:border-strokedark rounded">
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm font-medium">Item #{{ idx + 1 }}</span>
              <button v-if="items.length > 1" type="button" @click="removeItem(idx)" class="text-danger text-sm hover:underline">Remove</button>
            </div>

            <div class="mb-3">
              <label class="block text-sm font-medium text-black dark:text-white mb-2">Product <span class="text-danger">*</span></label>
              <BaseCombobox
                v-model="item.productId"
                :options="products"
                labelKey="name"
                valueKey="_id"
                placeholder="Select Product"
                @update:modelValue="onProductChange(idx)"
              />
            </div>

            <div class="mb-3">
              <label class="block text-sm font-medium text-black dark:text-white mb-2">Quantity <span class="text-danger">*</span></label>
              <input v-model.number="item.quantity" type="number" min="1" required @input="updateSerialCount(idx)" class="w-full rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white" />
            </div>

            <div v-if="getProductObj(item.productId)?.hasSerialNumbers" class="mb-3">
              <label class="block text-sm font-medium text-black dark:text-white mb-2">
                Serial Numbers <span class="text-danger">*</span>
                <span class="text-xs text-bodydark2 font-normal ml-2">(One per line)</span>
              </label>
              <textarea v-model="item.serialsText" rows="4" placeholder="SN001&#10;SN002&#10;SN003" class="w-full rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white font-mono text-sm"></textarea>
              <div class="mt-2 flex items-center justify-between">
                <p class="text-xs" :class="validateItem(item).isValid ? 'text-success' : 'text-danger'">{{ validateItem(item).message }}</p>
                <button v-if="getAvailableSerials(item.productId).length > 0" type="button" @click="autoFillSerials(idx)" class="text-xs text-primary hover:underline">
                  Auto-fill ({{ getAvailableSerials(item.productId).length }})
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-2 justify-end">
            <button type="button" @click="closeGenerateModal" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-opacity-90">Cancel</button>
            <button type="submit" :disabled="!canGenerate || generating" class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50">
              {{ generating ? 'Generating...' : `Generate ACNs (${items.reduce((sum, i) => sum + i.quantity, 0)} total)` }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Barcode Modal -->
    <div
      v-if="showBarcodeModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-boxdark rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-black dark:text-white">ACN Barcode</h3>
          <button @click="closeBarcodeModal" class="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>
        <div v-if="selectedACN" class="text-center">
          <p class="mb-2 text-black dark:text-white">{{ selectedACN.acnCode }}</p>
          <div v-if="barcodeImage" class="mb-4">
            <img :src="'data:image/png;base64,' + barcodeImage" alt="Barcode" class="mx-auto" />
          </div>
          <div class="flex gap-2 justify-center">
            <button
              @click="printBarcode(selectedACN)"
              class="bg-success text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Print
            </button>
            <button
              @click="downloadBarcode(selectedACN)"
              class="bg-warning text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Download
            </button>
            <button
              @click="closeBarcodeModal"
              class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-boxdark rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-black dark:text-white">Edit ACN</h3>
          <button @click="closeEditModal" class="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>
        <form @submit.prevent="updateACN">
          <div class="mb-4">
            <label class="block text-sm font-medium text-black dark:text-white mb-2"
              >ACN Code</label
            >
            <input
              v-model="editForm.acnCode"
              type="text"
              required
              class="w-full rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
            />
          </div>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              @click="closeEditModal"
              class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores'
import Swal from 'sweetalert2'
import BaseCombobox from '../Forms/BaseCombobox.vue'

export default {
  name: 'ACNManagement',
  components: { BaseCombobox },
  setup() {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const authStore = useAuthStore()
    const acns = ref([])
    const products = ref([])
    const searchQuery = ref('')
    const selectedProduct = ref('')
    const loading = ref(false)
    const selectedACNs = ref([])
    const generating = ref(false)
    const pagination = ref({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 20 })
    const assignmentStatus = ref({ acn: {}, serial: {} })

    const items = ref([{ productId: '', quantity: 1, serialsText: '' }])
    const showGenerateModal = ref(false)
    const showBarcodeModal = ref(false)
    const showEditModal = ref(false)
    const selectedACN = ref(null)
    const barcodeImage = ref('')
    const editForm = ref({ acnCode: '' })

    const getProductObj = (productId) => products.value.find((p) => p._id === productId)

    const getAvailableSerials = (productId) => {
      const product = getProductObj(productId)
      if (!product?.hasSerialNumbers) return []
      const serials = product.serialNumbers || []
      const acnList = product.assetControlNumbers || []
      return serials.filter((sn, idx) => !acnList[idx])
    }

    const parseSerials = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean)

    const validateItem = (item) => {
      const product = getProductObj(item.productId)
      if (!product?.hasSerialNumbers) return { isValid: true, message: '' }
      const serials = parseSerials(item.serialsText)
      if (serials.length === 0) return { isValid: false, message: `0 of ${item.quantity} serials` }
      if (serials.length !== item.quantity) return { isValid: false, message: `${serials.length} of ${item.quantity}` }
      if (new Set(serials).size !== serials.length) return { isValid: false, message: 'Duplicates' }
      return { isValid: true, message: `✓ ${serials.length}` }
    }

    const canGenerate = computed(() => {
      return items.value.every((item) => {
        if (!item.productId || item.quantity < 1) return false
        const product = getProductObj(item.productId)
        return product?.hasSerialNumbers ? validateItem(item).isValid : true
      })
    })

    const filteredACNs = computed(() => acns.value)

    const isAllSelected = computed(
      () => filteredACNs.value.length > 0 && selectedACNs.value.length === filteredACNs.value.length
    )

    const fetchACNs = async (page = 1) => {
      try {
        loading.value = true
        const params = { page, limit: pagination.value.limit }
        if (selectedProduct.value) params.productId = selectedProduct.value
        if (searchQuery.value) params.search = searchQuery.value
        
        const { data } = await axios.get(`${API_URL}/acns`, {
          params,
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        acns.value = data.acns
        if (data.pagination) {
          pagination.value = { ...pagination.value, ...data.pagination }
        }
        // Refresh assignment status for visible ACNs/serials
        const acnCodes = Array.from(new Set(acns.value.map(a => a.acnCode).filter(Boolean)))
        const serialNumbers = Array.from(new Set(acns.value.map(a => a.serialNumber).filter(Boolean)))
        if (acnCodes.length || serialNumbers.length) {
          const resp = await axios.post(`${API_URL}/acns/assignment-status`, { acnCodes, serialNumbers }, {
            headers: { Authorization: `Bearer ${authStore.token}` }
          })
          assignmentStatus.value = resp.data?.assignments || { acn: {}, serial: {} }
        } else {
          assignmentStatus.value = { acn: {}, serial: {} }
        }
      } catch (error) {
        console.error('Error fetching ACNs:', error)
      } finally {
        loading.value = false
      }
    }

    const goToPage = (page) => {
      if (page >= 1 && page <= pagination.value.totalPages) {
        fetchACNs(page)
      }
    }

    const fetchProducts = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/products/`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        products.value = data.products.filter((p) => p.hasSerialNumbers || p.hasAssetControlNumber)
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }

    const onProductChange = (index) => {
      items.value[index].serialsText = ''
      items.value[index].quantity = 1
    }

    const updateSerialCount = (index) => {
      const item = items.value[index]
      const current = parseSerials(item.serialsText)
      if (current.length > item.quantity) {
        item.serialsText = current.slice(0, item.quantity).join('\n')
      }
    }

    const autoFillSerials = (index) => {
      const item = items.value[index]
      const available = getAvailableSerials(item.productId)
      item.serialsText = available.slice(0, item.quantity).join('\n')
    }

    const addItem = () => {
      items.value.push({ productId: '', quantity: 1, serialsText: '' })
    }

    const removeItem = (index) => {
      if (items.value.length > 1) items.value.splice(index, 1)
    }

    const handleGenerate = async () => {
      try {
        generating.value = true
        let success = 0, fail = 0

        for (const item of items.value) {
          const product = getProductObj(item.productId)
          const serials = product?.hasSerialNumbers ? parseSerials(item.serialsText) : []

          for (let i = 0; i < item.quantity; i++) {
            try {
              const payload = { productId: item.productId }
              if (serials[i]) payload.serialNumber = serials[i]
              const { data } = await axios.post(`${API_URL}/acns/generate`, payload, {
                headers: { Authorization: `Bearer ${authStore.token}` }
              })
              if (data?.success) success++
              else fail++
            } catch { fail++ }
          }
        }

        if (success > 0) {
          await Swal.fire({
            icon: 'success',
            title: 'ACNs Generated',
            html: `<p>Successfully generated <strong>${success}</strong> ACN(s)</p>${fail > 0 ? `<p class="text-danger">Failed: ${fail}</p>` : ''}`,
            timer: 3000
          })
          closeGenerateModal()
          fetchACNs()
        } else {
          Swal.fire({ icon: 'error', title: 'Failed', text: 'Failed to generate any ACNs' })
        }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to generate ACNs' })
      } finally {
        generating.value = false
      }
    }

    const openGenerateModal = () => {
      items.value = [{ productId: '', quantity: 1, serialsText: '' }]
      showGenerateModal.value = true
    }

    const closeGenerateModal = () => {
      showGenerateModal.value = false
    }

    const viewBarcode = async (acn) => {
      try {
        selectedACN.value = acn
        const { data } = await axios.get(`${API_URL}/barcodes/acn/${acn._id}`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        if (data.success && data.printData) {
          barcodeImage.value = data.printData.barcodeImage
          showBarcodeModal.value = true
        }
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to load barcode' })
      }
    }

    const createBarcodeCanvas = async (acn) => {
      const { data } = await axios.get(`${API_URL}/barcodes/acn/${acn._id}`, {
        headers: { Authorization: `Bearer ${authStore.token}` }
      })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.src = 'data:image/png;base64,' + data.printData.barcodeImage

      return new Promise((resolve) => {
        img.onload = () => {
          canvas.width = Math.max(img.width, 300)
          canvas.height = img.height + 80
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = 'black'
          ctx.font = 'bold 32px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(acn.acnCode, canvas.width / 2, 32)
          if (acn.serialNumber) {
            ctx.font = 'bold 24px Arial'
            ctx.fillText(`S/N: ${acn.serialNumber}`, canvas.width / 2, 58)
          }
          ctx.drawImage(img, (canvas.width - img.width) / 2, acn.serialNumber ? 65 : 40)
          resolve(canvas)
        }
      })
    }

    const printBarcode = async (acn) => {
      try {
        const canvas = await createBarcodeCanvas(acn)
        const imgData = canvas.toDataURL('image/png')
        
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print ACN - ${acn.acnCode}</title>
            <style>
              @media print {
                @page { size: A4; margin: 0.5cm; }
                body { margin: 0; padding: 0; }
              }
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-wrap: wrap;
                gap: 0;
                padding: 0.5cm;
              }
              .barcode-item {
                width: 2in;
                height: 1.5in;
                border: 1px dashed #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                box-sizing: border-box;
                padding: 0.1in;
              }
              .barcode-item img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <div class="barcode-item"><img src="${imgData}" /></div>
          </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
          printWindow.onafterprint = () => printWindow.close()
        }
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to print barcode' })
      }
    }

    const downloadBarcode = async (acn) => {
      try {
        const canvas = await createBarcodeCanvas(acn)
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `acn-barcode-${acn.acnCode}.png`
          link.click()
          URL.revokeObjectURL(url)
        })
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to download barcode' })
      }
    }

    const bulkPrint = async () => {
      if (selectedACNs.value.length === 0) return
      try {
        loading.value = true
        const selectedAcnObjects = selectedACNs.value.map(id => acns.value.find(a => a._id === id)).filter(Boolean)
        
        const canvases = await Promise.all(selectedAcnObjects.map(acn => createBarcodeCanvas(acn)))
        const images = canvases.map(canvas => canvas.toDataURL('image/png'))
        
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print ACN Barcodes</title>
            <style>
              @media print {
                @page { size: A4; margin: 0.5cm; }
                body { margin: 0; padding: 0; }
              }
              body {
                font-family: Arial, sans-serif;
                display: grid;
                grid-template-columns: repeat(4, 2in);
                gap: 0.1in;
                padding: 0.5cm;
              }
              .barcode-item {
                width: 2in;
                height: 1.5in;
                border: 1px dashed #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                box-sizing: border-box;
                padding: 0.1in;
              }
              .barcode-item img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            ${images.map(img => `<div class="barcode-item"><img src="${img}" /></div>`).join('')}
          </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
          printWindow.onafterprint = () => printWindow.close()
        }
        selectedACNs.value = []
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to print barcodes' })
      } finally {
        loading.value = false
      }
    }

    const bulkDownload = async () => {
      if (selectedACNs.value.length === 0) return
      try {
        loading.value = true
        const selectedAcnObjects = selectedACNs.value.map(id => acns.value.find(a => a._id === id)).filter(Boolean)
        
        for (const acn of selectedAcnObjects) {
          const canvas = await createBarcodeCanvas(acn)
          await new Promise(resolve => {
            canvas.toBlob((blob) => {
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `acn-barcode-${acn.acnCode}.png`
              link.click()
              URL.revokeObjectURL(url)
              setTimeout(resolve, 100)
            })
          })
        }
        selectedACNs.value = []
        Swal.fire({ icon: 'success', title: 'Downloaded', text: `${selectedAcnObjects.length} barcode(s) downloaded`, timer: 2000 })
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to download barcodes' })
      } finally {
        loading.value = false
      }
    }

    const editACN = (acn) => {
      selectedACN.value = acn
      editForm.value.acnCode = acn.acnCode
      showEditModal.value = true
    }

    const updateACN = async () => {
      try {
        await axios.put(
          `${API_URL}/barcodes/acn/${selectedACN.value._id}`,
          { newAcnCode: editForm.value.acnCode },
          { headers: { Authorization: `Bearer ${authStore.token}` } }
        )
        const idx = acns.value.findIndex((a) => a._id === selectedACN.value._id)
        if (idx !== -1) acns.value[idx].acnCode = editForm.value.acnCode
        closeEditModal()
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to update ACN' })
      }
    }

    const toggleACNStatus = async (acn) => {
      try {
        await axios.patch(
          `${API_URL}/acns/${acn._id}/toggle-status`,
          {},
          { headers: { Authorization: `Bearer ${authStore.token}` } }
        )
        const idx = acns.value.findIndex((a) => a._id === acn._id)
        if (idx !== -1) acns.value[idx].isActive = !acns.value[idx].isActive
      } catch (error) {
        Swal.fire({ icon: 'error', text: 'Failed to toggle status' })
      }
    }

    const filterByProduct = () => fetchACNs(1)
    const toggleSelectAll = () => {
      selectedACNs.value = isAllSelected.value ? [] : filteredACNs.value.map((acn) => acn._id)
    }
    const closeBarcodeModal = () => {
      showBarcodeModal.value = false
      selectedACN.value = null
      barcodeImage.value = ''
    }
    const closeEditModal = () => {
      showEditModal.value = false
      selectedACN.value = null
    }

    onMounted(() => {
      fetchACNs()
      fetchProducts()
    })

    return {
      acns,
      products,
      searchQuery,
      selectedProduct,
      loading,
      selectedACNs,
      assignmentStatus,
      items,
      showGenerateModal,
      showBarcodeModal,
      showEditModal,
      selectedACN,
      barcodeImage,
      editForm,
      generating,
      getProductObj,
      getAvailableSerials,
      validateItem,
      canGenerate,
      filteredACNs,
      isAllSelected,
      fetchACNs,
      goToPage,
      pagination,
      onProductChange,
      updateSerialCount,
      autoFillSerials,
      addItem,
      removeItem,
      handleGenerate,
      openGenerateModal,
      closeGenerateModal,
      viewBarcode,
      printBarcode,
      downloadBarcode,
      bulkPrint,
      bulkDownload,
      editACN,
      updateACN,
      toggleACNStatus,
      filterByProduct,
      toggleSelectAll,
      closeBarcodeModal,
      closeEditModal
    }
  }
}
</script>
