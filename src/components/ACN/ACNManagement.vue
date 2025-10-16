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
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Total: {{ filteredACNs.length }} ACNs
          </p>
        </div>
        <div class="flex gap-2">
          <button
            @click="bulkPrint"
            :disabled="selectedACNs.length === 0"
            class="bg-success text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            Bulk Print ({{ selectedACNs.length }})
          </button>
          <button
            @click="fetchACNs"
            class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
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
        <select
          v-model="selectedProduct"
          @change="filterByProduct"
          class="rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white"
        >
          <option value="">All Products</option>
          <option v-for="product in products" :key="product._id" :value="product._id">
            {{ product.name }} ({{ product.sku }})
          </option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredACNs.length === 0" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400">No ACNs found</p>
    </div>

    <!-- ACN Table -->
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
                  class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-3 text-center font-medium text-white hover:bg-opacity-90"
                >
                  View
                </button>
                <button
                  @click="printBarcode(acn)"
                  class="inline-flex items-center justify-center rounded-md bg-success py-2 px-3 text-center font-medium text-white hover:bg-opacity-90"
                >
                  Print
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
              <div class="flex items-center space-x-3.5">
                <button @click="editACN(acn)" class="hover:text-primary" title="Edit ACN">
                  Edit
                </button>
                <button
                  @click="toggleACNStatus(acn)"
                  :class="acn.isActive ? 'hover:text-danger' : 'hover:text-success'"
                  :title="acn.isActive ? 'Deactivate ACN' : 'Activate ACN'"
                >
                  {{ acn.isActive ? 'Deactivate' : 'Activate' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Barcode Modal -->
    <div
      v-if="showBarcodeModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-boxdark rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-black dark:text-white">ACN Barcode</h3>
          <button @click="closeBarcodeModal" class="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div v-if="selectedACN" class="text-center">
          <p class="mb-2 text-black dark:text-white">{{ selectedACN.acnCode }}</p>
          <div v-if="barcodeImage" class="mb-4">
            <img :src="'data:image/png;base64,' + barcodeImage" alt="Barcode" class="mx-auto" />
          </div>
          <div class="flex gap-2 justify-center">
            <button
              @click="printBarcode(selectedACN)"
              class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Print Barcode
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

    <!-- Edit ACN Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-boxdark rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-black dark:text-white">Edit ACN</h3>
          <button @click="closeEditModal" class="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <form @submit.prevent="updateACN">
          <div class="mb-4">
            <label class="block text-sm font-medium text-black dark:text-white mb-2">
              ACN Code
            </label>
            <input
              v-model="editForm.acnCode"
              type="text"
              required
              class="w-full rounded border border-stroke bg-gray py-2 px-4 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white"
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
              Update ACN
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
const authStore = useAuthStore()

export default {
  name: 'ACNManagement',
  setup() {
    const acns = ref([])
    const products = ref([])
    const searchQuery = ref('')
    const selectedProduct = ref('')
    const loading = ref(false)
    const selectedACNs = ref([])

    // Modal states
    const showBarcodeModal = ref(false)
    const showEditModal = ref(false)
    const selectedACN = ref(null)
    const barcodeImage = ref('')

    // Edit form
    const editForm = ref({
      acnCode: ''
    })

    const filteredACNs = computed(() => {
      let filtered = acns.value

      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(
          (acn) =>
            acn.acnCode.toLowerCase().includes(query) ||
            acn.serialNumber?.toLowerCase().includes(query) ||
            acn.product?.name?.toLowerCase().includes(query)
        )
      }

      return filtered
    })

    const isAllSelected = computed(() => {
      return (
        filteredACNs.value.length > 0 && selectedACNs.value.length === filteredACNs.value.length
      )
    })

    const fetchACNs = async () => {
      try {
        loading.value = true
        const params = {}

        if (selectedProduct.value) {
          params.productId = selectedProduct.value
        }

        const response = await axios.get('http://localhost:5000/api/acns', {
          params,
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })
        acns.value = response.data.acns
      } catch (error) {
        console.error('Error fetching ACNs:', error)
      } finally {
        loading.value = false
      }
    }

    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/products/', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })
        products.value = response.data.products.filter((p) => p.hasAssetControlNumber)
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }

    const viewBarcode = async (acn) => {
      try {
        selectedACN.value = acn
        const response = await axios.get(`http://localhost:5000/api/barcodes/acn/${acn._id}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        })
        if (response.data.success && response.data.printData) {
          barcodeImage.value = response.data.printData.barcodeImage
          showBarcodeModal.value = true
        }
      } catch (error) {
        console.error('Error fetching barcode:', error)
        alert('Failed to load barcode')
      }
    }

    const createBarcodeCanvas = async (acn) => {
      const response = await axios.get(`http://localhost:5000/api/barcodes/acn/${acn._id}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      const barcodeImg = new Image()
      barcodeImg.src = 'data:image/png;base64,' + response.data.printData.barcodeImage

      return new Promise((resolve) => {
        barcodeImg.onload = () => {
          canvas.width = Math.max(barcodeImg.width, 300)
          canvas.height = barcodeImg.height + 60

          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          ctx.fillStyle = 'black'
          ctx.font = '25px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(acn.acnCode, canvas.width / 2, 25)

          if (acn.serialNumber) {
            ctx.font = '20px Arial'
            ctx.fillText(`S/N: ${acn.serialNumber}`, canvas.width / 2, 45)
          }

          const x = (canvas.width - barcodeImg.width) / 2
          ctx.drawImage(barcodeImg, x, 50)

          resolve(canvas)
        }
      })
    }

    const printBarcode = async (acn) => {
      try {
        const canvas = await createBarcodeCanvas(acn)
        canvas.toBlob((blob) => {
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `acn-barcode-${acn.acnCode}.png`)
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
        })
      } catch (error) {
        console.error('Error printing barcode:', error)
        alert('Failed to download barcode')
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
          `http://localhost:5000/api/barcodes/acn/${selectedACN.value._id}`,
          {
            newAcnCode: editForm.value.acnCode
          },
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )

        // Update local data
        const index = acns.value.findIndex((a) => a._id === selectedACN.value._id)
        if (index !== -1) {
          acns.value[index].acnCode = editForm.value.acnCode
        }

        closeEditModal()
      } catch (error) {
        console.error('Error updating ACN:', error)
      }
    }

    const toggleACNStatus = async (acn) => {
      try {
        await axios.patch(
          `http://localhost:5000/api/acns/${acn._id}/toggle-status`,
          {},
          {
            headers: {
              Authorization: `Bearer ${authStore.token}`
            }
          }
        )

        // Update local data
        const index = acns.value.findIndex((a) => a._id === acn._id)
        if (index !== -1) {
          acns.value[index].isActive = !acns.value[index].isActive
        }
      } catch (error) {
        console.error('Error toggling ACN status:', error)
      }
    }

    const filterByProduct = () => {
      fetchACNs()
    }

    const toggleSelectAll = () => {
      if (isAllSelected.value) {
        selectedACNs.value = []
      } else {
        selectedACNs.value = filteredACNs.value.map((acn) => acn._id)
      }
    }

    const bulkPrint = async () => {
      if (selectedACNs.value.length === 0) return

      try {
        loading.value = true
        for (const acnId of selectedACNs.value) {
          const acn = acns.value.find((a) => a._id === acnId)
          if (acn) {
            const canvas = await createBarcodeCanvas(acn)
            canvas.toBlob((blob) => {
              const url = window.URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', `acn-barcode-${acn.acnCode}.png`)
              document.body.appendChild(link)
              link.click()
              link.remove()
              window.URL.revokeObjectURL(url)
            })
          }
        }
        selectedACNs.value = []
      } catch (error) {
        console.error('Error bulk printing:', error)
        alert('Failed to print some barcodes')
      } finally {
        loading.value = false
      }
    }

    const closeBarcodeModal = () => {
      showBarcodeModal.value = false
      selectedACN.value = null
      barcodeImage.value = ''
    }

    const closeEditModal = () => {
      showEditModal.value = false
      selectedACN.value = null
      editForm.value.acnCode = ''
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
      filteredACNs,
      isAllSelected,
      showBarcodeModal,
      showEditModal,
      selectedACN,
      barcodeImage,
      editForm,
      fetchACNs,
      viewBarcode,
      printBarcode,
      editACN,
      updateACN,
      toggleACNStatus,
      filterByProduct,
      toggleSelectAll,
      bulkPrint,
      closeBarcodeModal,
      closeEditModal
    }
  }
}
</script>
