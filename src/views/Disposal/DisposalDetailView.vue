<script setup>
import { ref, onMounted, computed } from 'vue'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const disposal = ref(null)
const loading = ref(false)
const error = ref('')
const itemInfo = ref({})

const id = computed(() => String(route.params.id || ''))

async function fetchDisposal() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/disposal/${id.value}`)
    disposal.value = data?.disposal || null
    await resolveAllItems()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load disposal'
  } finally {
    loading.value = false
  }
}

function makeKey(it) {
  return String(it?.itemId || it?.acn || it?.serialNumber || Math.random())
}

async function resolveAllItems() {
  itemInfo.value = {}
  const items =
    disposal.value?.items && disposal.value.items.length
      ? disposal.value.items
      : [
          {
            inventoryRecordId: disposal.value?.inventoryRecordId,
            itemId: disposal.value?.itemId,
            acn: disposal.value?.acn,
            serialNumber: disposal.value?.serialNumber,
            description: disposal.value?.description
          }
        ]
  for (const it of items) {
    const k = makeKey(it)
    try {
      let record = null
      if (it?.inventoryRecordId) {
        try {
          const { data } = await axios.get(`/inventory-records/${it.inventoryRecordId}`)
          record = data?.record || null
        } catch (_) {
          void 0
        }
      }
      const acn = String(it?.acn || '').trim()
      const serial = String(it?.serialNumber || '').trim()
      if (!record && (acn || serial)) {
        const params = { limit: 5 }
        if (acn) params.acn = acn
        else if (serial) params.serialNumber = serial
        try {
          const irRes = await axios.get('/inventory-records', { params })
          const records = irRes?.data?.records || []
          record = Array.isArray(records) && records.length ? records[0] : null
        } catch (_) {
          void 0
        }
      }
      let eu = ''
      let office = ''
      let remarks = ''
      let description = ''
      if (record) {
        office = record?.department || ''
        const norm = (s) =>
          String(s || '')
            .trim()
            .toUpperCase()
        let item = null
        if (it?.itemId)
          item = (record.items || []).find((i) => String(i._id) === String(it.itemId)) || null
        if (!item && acn)
          item = (record.items || []).find((i) => norm(i?.acn) === norm(acn)) || null
        if (!item && serial)
          item = (record.items || []).find((i) => String(i?.serialNumber || '') === serial) || null
        if (!item && acn) {
          const parent = (record.items || []).find(
            (i) =>
              Array.isArray(i.secondaryItems) &&
              i.secondaryItems.some((s) => norm(s?.acn) === norm(acn))
          )
          if (parent) item = parent
        }
        if (!item && serial) {
          const parentBySerial = (record.items || []).find(
            (i) =>
              Array.isArray(i.secondaryItems) &&
              i.secondaryItems.some((s) => String(s?.serialNumber || '') === serial)
          )
          if (parentBySerial) item = parentBySerial
        }
        eu = item?.endUserOrMR || ''
        remarks = item?.remarks || ''
        description =
          item?.description ||
          item?.productName ||
          item?.monitorAndSerial ||
          item?.printerOrScanner ||
          ''
      }
      itemInfo.value[k] = { endUser: eu, office, remarks, description }
    } catch (_) {
      itemInfo.value[k] = { endUser: '', office: '', remarks: '', description: '' }
    }
  }
}

onMounted(fetchDisposal)

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}

function itemsForExport() {
  const items =
    disposal.value?.items && disposal.value.items.length
      ? disposal.value.items
      : [
          {
            inventoryRecordId: disposal.value?.inventoryRecordId,
            itemId: disposal.value?.itemId,
            acn: disposal.value?.acn,
            serialNumber: disposal.value?.serialNumber,
            description: disposal.value?.description
          }
        ]
  return items
}

function downloadDisposalPdf() {
  if (!disposal.value) return
  const doc = new jsPDF()
  const title = `Disposal ${disposal.value.disposalNumber || ''}`
  const meta1 = `Reason: ${disposal.value.reason || '—'}`
  const meta2 = `Date: ${formatDate(disposal.value.disposalDate)}`
  const meta3 = `Approved By: ${disposal.value.approvedByName || 'Pending'}`
  const meta4 = `Prepared By: ${disposal.value?.createdBy?.name || '—'}`
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.text(meta1, 14, 24)
  doc.text(meta2, 80, 24)
  doc.text(meta3, 14, 30)
  doc.text(meta4, 80, 30)
  const rows = itemsForExport().map((it) => [
    it.acn || '—',
    it.serialNumber || '—',
    itemInfo.value[makeKey(it)]?.description || it.description || '—',
    itemInfo.value[makeKey(it)]?.endUser || '—',
    itemInfo.value[makeKey(it)]?.office || '—',
    itemInfo.value[makeKey(it)]?.remarks || '—'
  ])
  autoTable(doc, {
    startY: 36,
    head: [['ACN', 'Serial', 'Description', 'End User', 'Office', 'Remarks']],
    body: rows
  })
  const filename = `DSP-${disposal.value.disposalNumber || id.value}.pdf`
  doc.save(filename)
}

function printDisposal() {
  if (!disposal.value) return
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  const rows = itemsForExport()
    .map(
      (it) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${it.acn || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${it.serialNumber || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${
        itemInfo.value[makeKey(it)]?.description || it.description || ''
      }</td>
      <td style="padding:8px;border:1px solid #ddd;">${
        itemInfo.value[makeKey(it)]?.endUser || ''
      }</td>
      <td style="padding:8px;border:1px solid #ddd;">${
        itemInfo.value[makeKey(it)]?.office || ''
      }</td>
      <td style="padding:8px;border:1px solid #ddd;">${
        itemInfo.value[makeKey(it)]?.remarks || ''
      }</td>
    </tr>
  `
    )
    .join('')
  const html = `
  <html>
    <head>
      <title>Disposal ${disposal.value.disposalNumber || ''}</title>
      <style>
        @media print {
          @page { margin: 16mm; }
        }
        body { font-family: Arial, sans-serif; color: #111; }
        .meta { margin-bottom: 12px; }
        .meta div { margin: 2px 0; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f5f5f5; }
        th, td { padding: 8px; border: 1px solid #ddd; font-size: 12px; }
      </style>
    </head>
    <body>
      <h2>Disposal ${disposal.value.disposalNumber || ''}</h2>
      <div class="meta">
        <div><strong>Reason:</strong> ${disposal.value.reason || '—'}</div>
        <div><strong>Date:</strong> ${formatDate(disposal.value.disposalDate)}</div>
        <div><strong>Approved By:</strong> ${disposal.value.approvedByName || 'Pending'}</div>
        <div><strong>Prepared By:</strong> ${disposal.value?.createdBy?.name || '—'}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>ACN</th>
            <th>Serial</th>
            <th>Description</th>
            <th>End User</th>
            <th>Office</th>
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
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

async function downloadProofImagesZip() {
  if (!disposal.value) return
  const zip = new JSZip()
  const dn = String(disposal.value.disposalNumber || 'DISPOSAL').trim()
  const folderName = `${dn} proof image`
  const folder = zip.folder(folderName)
  const addDataUrlFile = (dataUrl, nameFallback, idx) => {
    if (!dataUrl || !folder) return
    try {
      const [header, b64] = String(dataUrl).split(',')
      const mime = (header || '').match(/data:(.*?);base64/i)?.[1] || 'image/png'
      const ext = (mime.split('/')[1] || 'png').toLowerCase()
      const fname = `${(nameFallback || `image-${idx + 1}`).replace(/\s+/g, '_')}.${ext}`
      folder.file(fname, b64, { base64: true })
    } catch (_) {
      void 0
    }
  }
  const proofs = Array.isArray(disposal.value.proofs) ? disposal.value.proofs : []
  if (proofs.length) {
    proofs.forEach((p, i) => addDataUrlFile(p?.image, p?.name || `proof-${i + 1}`, i))
  } else {
    const imgs = Array.isArray(disposal.value.proofImages) ? disposal.value.proofImages : []
    imgs.forEach((img, i) => addDataUrlFile(img, `proof-${i + 1}`, i))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${folderName}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <DefaultLayout>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Disposal Record</h1>
        <p class="text-sm text-bodydark2 mt-1">View disposal details</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/disposal')"
      >
        ← Back to List
      </button>
    </div>

    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ disposal?.disposalNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">Disposal ID: {{ id }}</p>
          </div>
          <div class="text-right space-y-2">
            <div>
              <div class="text-xs text-bodydark2">Approved By</div>
              <div class="text-sm font-medium">
                {{
                  disposal?.approvedByName ||
                  (disposal?.approvedBy
                    ? disposal.approvedBy.firstName + ' ' + (disposal.approvedBy.lastName || '')
                    : '—')
                }}
              </div>
            </div>
            <div class="flex items-center gap-2 justify-end">
              <button class="rounded border px-3 py-1 text-sm" @click="printDisposal">Print</button>
              <button
                class="rounded bg-primary text-white px-3 py-1 text-sm"
                @click="downloadDisposalPdf"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading disposal...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <div v-else-if="disposal" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div class="text-xs text-bodydark2 mb-1">Reason</div>
            <div class="text-sm font-medium capitalize">{{ disposal.reason || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Disposal Date</div>
            <div class="text-sm font-medium">{{ formatDate(disposal.disposalDate) }}</div>
          </div>

          <div>
            <div class="text-xs text-bodydark2 mb-1">Item Description</div>
            <div class="text-sm font-medium">{{ disposal.description || '—' }}</div>
          </div>
        </div>

        <div v-if="disposal?.items?.length || disposal" class="mb-6">
          <h3 class="text-lg font-semibold mb-3">Items ({{ disposal?.items?.length || 1 }})</h3>
          <div class="rounded border border-stroke dark:border-strokedark">
            <table class="w-full">
              <thead class="bg-gray-100">
                <tr>
                  <th class="p-3 text-left">ACN</th>
                  <th class="p-3 text-left">Serial</th>
                  <th class="p-3 text-left">Description</th>
                  <th class="p-3 text-left">End User</th>
                  <th class="p-3 text-left">Office</th>
                  <th class="p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="it in disposal?.items?.length
                    ? disposal.items
                    : [
                        {
                          inventoryRecordId: disposal?.inventoryRecordId,
                          itemId: disposal?.itemId,
                          acn: disposal?.acn,
                          serialNumber: disposal?.serialNumber,
                          description: disposal?.description
                        }
                      ]"
                  :key="it.itemId || it.acn || it.serialNumber || Math.random()"
                >
                  <td class="p-3">{{ it.acn || '—' }}</td>
                  <td class="p-3">{{ it.serialNumber || '—' }}</td>
                  <td class="p-3">
                    {{ itemInfo[makeKey(it)]?.description || it.description || '—' }}
                  </td>
                  <td class="p-3">{{ itemInfo[makeKey(it)]?.endUser || '—' }}</td>
                  <td class="p-3">{{ itemInfo[makeKey(it)]?.office || '—' }}</td>
                  <td class="p-3">{{ itemInfo[makeKey(it)]?.remarks || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="disposal?.reasonDetails" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Reason Details</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">
            {{ disposal.reasonDetails }}
          </div>
        </div>

        <div v-if="disposal?.notes" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Notes</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ disposal.notes }}</div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold">
              Proof Images ({{ disposal?.proofs?.length || disposal?.proofImages?.length || 0 }})
            </h3>
            <div class="flex items-center gap-2">
              <button class="rounded border px-3 py-1 text-sm" @click="downloadProofImagesZip">
                Download All
              </button>
            </div>
          </div>
          <div
            v-if="disposal?.proofs?.length"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <div
              v-for="(p, i) in disposal.proofs"
              :key="(p.image || '') + i"
              class="rounded border border-stroke dark:border-strokedark p-2"
            >
              <div class="text-xs text-bodydark2 mb-1">
                Name: <span class="font-medium">{{ p.name || '—' }}</span>
              </div>
              <img :src="p.image" alt="Proof Image" class="w-full h-32 object-cover rounded" />
              <a
                :href="p.image"
                target="_blank"
                class="text-primary text-xs font-medium hover:underline mt-2 inline-block"
                >View Full Image →</a
              >
            </div>
          </div>
          <div
            v-else-if="disposal?.proofImages?.length"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <div
              v-for="(img, i) in disposal.proofImages"
              :key="img + i"
              class="rounded border border-stroke dark:border-strokedark p-2"
            >
              <img :src="img" alt="Proof Image" class="w-full h-32 object-cover rounded" />
              <a
                :href="img"
                target="_blank"
                class="text-primary text-xs font-medium hover:underline mt-2 inline-block"
                >View Full Image →</a
              >
            </div>
          </div>
          <div v-else class="text-sm text-bodydark2 p-4">No proof images uploaded</div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
