<template>
  <DefaultLayout>
    <Breadcrumb 
      :breadcrumbs="[
        { title: 'Supplier Returns', to: '/warranty/supplier-returns' },
        { title: returnData.returnNumber || 'Loading...' }
      ]"
      :pageTitle="`Return #${returnData.returnNumber || '...'}`"
    >
      <template #actions>
        <div class="flex space-x-2">
          <button 
            v-if="canUpdateStatus"
            @click="showStatusModal = true"
            class="btn btn-outline-primary"
          >
            Update Status
          </button>
          <router-link 
            v-if="canEdit"
            :to="`/warranty/supplier-returns/${returnId}/edit`"
            class="btn btn-outline-secondary"
          >
            Edit
          </router-link>
          <button 
            v-if="canCancel"
            @click="confirmCancel"
            class="btn btn-outline-danger"
          >
            Cancel Return
          </button>
          <button 
            v-if="canPrint"
            @click="printReturn"
            class="btn btn-outline-primary"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </template>
    </Breadcrumb>

    <div class="grid grid-cols-12 gap-5">
      <!-- Main Content -->
      <div class="col-span-12 lg:col-span-8">
        <!-- Return Summary -->
        <Card class="mb-5">
          <div class="p-5">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-lg font-medium mb-2">Return Summary</h2>
                <div class="text-sm text-gray-600">
                  <div>Created: {{ formatDate(returnData.createdAt) }}</div>
                  <div>Last Updated: {{ formatDate(returnData.updatedAt) }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm text-gray-500">Status</div>
                <span 
                  :class="getStatusBadgeClass(returnData.status)"
                  class="px-3 py-1 text-sm font-medium rounded-full"
                >
                  {{ formatStatus(returnData.status) }}
                </span>
              </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-500">Return Number</h3>
                <p class="mt-1">{{ returnData.returnNumber }}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Warranty Claim</h3>
                <p class="mt-1">
                  <span v-if="returnData.isWarrantyClaim" class="text-green-600 font-medium">Yes</span>
                  <span v-else class="text-gray-500">No</span>
                </p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Warranty Number</h3>
                <p class="mt-1">{{ returnData.warrantyNumber || 'N/A' }}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500">Reason</h3>
                <p class="mt-1">{{ formatReason(returnData.reason) }}</p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Item Details -->
        <Card class="mb-5">
          <div class="p-5">
            <h2 class="text-lg font-medium mb-4">Item Details</h2>
            
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 class="text-sm font-medium text-gray-500">ACN</h3>
                  <p class="mt-1">{{ returnData.acn || 'N/A' }}</p>
                </div>
                <div>
                  <h3 class="text-sm font-medium text-gray-500">Serial Number</h3>
                  <p class="mt-1">{{ returnData.serialNumber || 'N/A' }}</p>
                </div>
                <div>
                  <h3 class="text-sm font-medium text-gray-500">Product</h3>
                  <p class="mt-1">{{ returnData.productId?.name || 'N/A' }}</p>
                </div>
                <div>
                  <h3 class="text-sm font-medium text-gray-500">Model</h3>
                  <p class="mt-1">{{ returnData.productId?.sku || 'N/A' }}</p>
                </div>
              </div>

              <div class="mt-4 pt-4 border-t">
                <h3 class="text-sm font-medium text-gray-500 mb-2">Issue Description</h3>
                <p class="whitespace-pre-line">{{ returnData.issueDescription || 'No description provided.' }}</p>
              </div>

              <div v-if="returnData.notes" class="mt-4 pt-4 border-t">
                <h3 class="text-sm font-medium text-gray-500 mb-2">Additional Notes</h3>
                <p class="whitespace-pre-line">{{ returnData.notes }}</p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Resolution Details -->
        <Card v-if="returnData.resolution || returnData.supplierResponse" class="mb-5">
          <div class="p-5">
            <h2 class="text-lg font-medium mb-4">Resolution Details</h2>
            
            <div class="space-y-4">
              <div v-if="returnData.resolution">
                <h3 class="text-sm font-medium text-gray-500">Resolution</h3>
                <p class="mt-1">{{ formatResolution(returnData.resolution) }}</p>
                
                <div v-if="returnData.replacementACN" class="mt-2">
                  <h4 class="text-xs font-medium text-gray-500">Replacement ACN</h4>
                  <p>{{ returnData.replacementACN }}</p>
                </div>
              </div>

              <div v-if="returnData.supplierResponse">
                <h3 class="text-sm font-medium text-gray-500">Supplier Response</h3>
                <p class="mt-1 whitespace-pre-line">{{ returnData.supplierResponse }}</p>
              </div>

              <div v-if="returnData.resolutionDate">
                <h3 class="text-sm font-medium text-gray-500">Resolved On</h3>
                <p class="mt-1">{{ formatDateTime(returnData.resolutionDate) }}</p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Activity Log -->
        <Card>
          <div class="p-5">
            <h2 class="text-lg font-medium mb-4">Activity Log</h2>
            
            <div class="space-y-4">
              <div v-if="loading" class="text-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
              
              <div v-else-if="activityLog.length === 0" class="text-center text-gray-500 py-4">
                No activity found
              </div>
              
              <div v-else class="space-y-4">
                <div 
                  v-for="log in activityLog" 
                  :key="log._id"
                  class="flex items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div class="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path v-if="log.action === 'created'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      <path v-else-if="log.action === 'status_updated'">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </path>
                      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div class="ml-4">
                    <div class="flex items-center">
                      <p class="text-sm font-medium">{{ log.user?.name || 'System' }}</p>
                      <span class="mx-2 text-gray-400">•</span>
                      <p class="text-xs text-gray-500">{{ formatDateTime(log.timestamp) }}</p>
                    </div>
                    <p class="text-sm mt-1">
                      <span v-if="log.action === 'created'">Created this return</span>
                      <span v-else-if="log.action === 'status_updated'">
                        Changed status from 
                        <span class="font-medium">{{ formatStatus(log.metadata?.from) }}</span> to 
                        <span class="font-medium">{{ formatStatus(log.metadata?.to) }}</span>
                      </span>
                      <span v-else-if="log.action === 'updated'">
                        Updated return details
                      </span>
                      <span v-else>{{ log.action }}</span>
                    </p>
                    <p v-if="log.notes" class="text-sm text-gray-600 mt-1">{{ log.notes }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="col-span-12 lg:col-span-4 space-y-5">
        <!-- Warranty Information -->
        <Card v-if="returnData.isWarrantyClaim">
          <div class="p-5">
            <h3 class="text-md font-medium mb-3">Warranty Information</h3>
            <div class="space-y-2">
              <div>
                <div class="text-sm font-medium text-gray-500">Warranty Status</div>
                <div>
                  <span :class="warrantyInfo.isUnderWarranty ? 'text-green-600' : 'text-red-600'" class="font-medium">
                    {{ warrantyInfo.isUnderWarranty ? 'Under Warranty' : 'Out of Warranty' }}
                  </span>
                </div>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-500">Expiration</div>
                <div>{{ warrantyInfo.expiryDate ? formatDate(warrantyInfo.expiryDate) : 'N/A' }}</div>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-500">Provider</div>
                <div>{{ formatProvider(returnData.supplierId) }}</div>
              </div>
            </div>
          </div>
        </Card>

        <!-- Shipping Information -->
        <Card>
          <div class="p-5">
            <h3 class="text-md font-medium mb-3">Shipping Information</h3>
            <div class="space-y-2">
              <div v-if="returnData.trackingNumber">
                <div class="text-sm font-medium text-gray-500">Tracking Number</div>
                <div class="flex items-center">
                  <span>{{ returnData.trackingNumber }}</span>
                  <a 
                    v-if="returnData.trackingUrl" 
                    :href="returnData.trackingUrl" 
                    target="_blank" 
                    class="ml-2 text-primary hover:underline flex items-center text-sm"
                  >
                    Track
                    <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              <div v-else class="text-sm text-gray-500">
                No shipping information available
              </div>
            </div>
          </div>
        </Card>

        <!-- Documents -->
        <Card v-if="returnData.documents && returnData.documents.length > 0">
          <div class="p-5">
            <h3 class="text-md font-medium mb-3">Documents</h3>
            <div class="space-y-2">
              <div v-for="doc in returnData.documents" :key="doc._id" class="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div class="flex items-center">
                  <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span class="ml-2 text-sm truncate max-w-xs">{{ doc.name || 'Document' }}</span>
                </div>
                <a 
                  :href="doc.url" 
                  target="_blank" 
                  class="text-primary hover:text-primary-dark"
                  title="Download"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Status Update Modal -->
    <div v-if="showStatusModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">Update Status</h3>
            <button @click="showStatusModal = false" class="text-gray-500 hover:text-gray-700">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form @submit.prevent="updateStatus">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  New Status <span class="text-red-500">*</span>
                </label>
                <select 
                  v-model="statusUpdate.newStatus"
                  class="form-select w-full"
                  required
                >
                  <option v-for="status in availableStatuses" 
                          :key="status.value" 
                          :value="status.value"
                          :disabled="status.value === returnData.status">
                    {{ status.label }}
                  </option>
                </select>
              </div>

              <div v-if="statusUpdate.newStatus === 'replaced'">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Replacement ACN <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="statusUpdate.replacementACN"
                  type="text"
                  class="form-input w-full"
                  placeholder="Enter ACN of replacement item"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  v-model="statusUpdate.notes"
                  rows="3"
                  class="form-textarea w-full"
                  placeholder="Add any relevant notes about this status update..."
                ></textarea>
              </div>
            </div>

            <div class="mt-6 flex justify-end space-x-3">
              <button 
                type="button" 
                @click="showStatusModal = false"
                class="btn btn-outline-secondary"
                :disabled="updatingStatus"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="updatingStatus || !statusUpdate.newStatus"
              >
                <span v-if="updatingStatus" class="inline-flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </span>
                <span v-else>Update Status</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import DefaultLayout from '../../layouts/DefaultLayout.vue';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb.vue';
import Card from '@/components/Card/Card.vue';
import axios from '../../utils/axios';
import { format, parseISO } from 'date-fns';

const route = useRoute();
const router = useRouter();

const returnId = route.params.id;

// Component state
const loading = ref(true);
const returnData = ref({
  returnNumber: '...',
  status: '',
  isWarrantyClaim: false,
  warranty: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  documents: []
});

const activityLog = ref([]);
const showStatusModal = ref(false);
const updatingStatus = ref(false);

// Status update form
const statusUpdate = ref({
  newStatus: '',
  notes: '',
  replacementACN: ''
});

// Status options based on current status
const availableStatuses = computed(() => {
  const currentStatus = returnData.value.status;
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'sent_to_supplier', label: 'Sent to Supplier' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'repaired', label: 'Repaired' },
    { value: 'replaced', label: 'Replaced' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Filter out current status and implement workflow rules
  return statusOptions.filter(option => option.value !== currentStatus);
});

// Permission checks
const canUpdateStatus = computed(() => {
  const allowedStatuses = ['pending', 'sent_to_supplier', 'under_review', 'approved'];
  return allowedStatuses.includes(returnData.value.status);
});

const canEdit = computed(() => {
  return ['pending', 'sent_to_supplier'].includes(returnData.value.status);
});

const canCancel = computed(() => {
  return ['pending', 'sent_to_supplier', 'under_review'].includes(returnData.value.status);
});

const canPrint = computed(() => {
  return returnData.value.status !== '';
});

// Formatting functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return format(parseISO(dateString), 'MMM d, yyyy');
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
};

// Derived warranty info from stored expiry date
const warrantyInfo = computed(() => {
  const expiry = returnData.value?.warrantyExpiryDate || null;
  const isUnder = expiry ? new Date(expiry) > new Date() : false;
  return {
    expiryDate: expiry,
    isUnderWarranty: isUnder,
  };
});

const formatStatus = (status) => {
  if (!status) return '';
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatReason = (reason) => {
  if (!reason) return 'N/A';
  const reasons = {
    'defective': 'Defective Item',
    'wrong_item': 'Wrong Item Shipped',
    'damaged': 'Damaged in Transit',
    'not_as_described': 'Not as Described',
    'other': 'Other'
  };
  return reasons[reason] || reason;
};

const formatResolution = (resolution) => {
  if (!resolution) return 'N/A';
  const resolutions = {
    'repaired': 'Item was repaired',
    'replaced': 'Item was replaced',
    'refunded': 'Refund was issued',
    'rejected': 'Return was rejected',
    'no_action': 'No action taken'
  };
  return resolutions[resolution] || resolution;
};

const formatProvider = (provider) => {
  if (!provider) return 'N/A';
  if (typeof provider === 'string') {
    return provider
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  // Populated supplier object
  return provider?.name || 'N/A';
};

const getStatusBadgeClass = (status) => {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent_to_supplier: 'bg-blue-100 text-blue-800',
    under_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    repaired: 'bg-teal-100 text-teal-800',
    replaced: 'bg-indigo-100 text-indigo-800',
    refunded: 'bg-pink-100 text-pink-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};

// API methods
const fetchReturnDetails = async () => {
  try {
    loading.value = true;
    const response = await axios.get(`/api/supplier-returns/${returnId}`);
    const sr = response.data?.supplierReturn || response.data;
    returnData.value = sr;
    // Set initial status for the update form
    statusUpdate.value.newStatus = sr.status;
    // Activity log not yet implemented; keep empty
    activityLog.value = [];
  } catch (error) {
    console.error('Error fetching return details:', error);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load return details' });
    router.push('/warranty/supplier-returns');
  } finally {
    loading.value = false;
  }
};

const fetchActivityLog = async () => {
  // Placeholder: backend endpoint pending implementation
  activityLog.value = [];
};

const updateStatus = async () => {
  try {
    updatingStatus.value = true;
    
    const payload = {
      status: statusUpdate.value.newStatus,
      internalNotes: statusUpdate.value.notes
    };
    
    if (statusUpdate.value.newStatus === 'replaced' && statusUpdate.value.replacementACN) {
      payload.replacementACN = statusUpdate.value.replacementACN;
    }
    
    await axios.patch(`/api/supplier-returns/${returnId}`, payload);
    
    await Swal.fire({ icon: 'success', title: 'Success', text: 'Status updated successfully' });
    showStatusModal.value = false;
    await fetchReturnDetails(); // Refresh data
  } catch (error) {
    console.error('Error updating status:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to update status' });
  } finally {
    updatingStatus.value = false;
  }
};

const confirmCancel = () => {
  if (confirm('Are you sure you want to cancel this return? This action cannot be undone.')) {
    cancelReturn();
  }
};

const cancelReturn = async () => {
  try {
    await axios.patch(`/api/supplier-returns/${returnId}`, {
      status: 'cancelled',
      internalNotes: 'Return was cancelled by user.'
    });
    
    await Swal.fire({ icon: 'success', title: 'Success', text: 'Return has been cancelled' });
    await fetchReturnDetails(); // Refresh data
  } catch (error) {
    console.error('Error cancelling return:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to cancel return' });
  }
};

const printReturn = () => {
  // In a real app, this would open a print dialog with a formatted version
  window.print();
};

// Lifecycle hooks
onMounted(() => {
  if (returnId) {
    fetchReturnDetails();
  } else {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No return ID provided' });
    router.push('/warranty/supplier-returns');
  }
});
</script>
