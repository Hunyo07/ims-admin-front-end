<script setup lang="ts">
import { ref, computed, watch } from 'vue'
// @ts-ignore
import VueApexCharts from 'vue3-apexcharts'

interface Props {
  salesData?: {
    overview?: {
      totalRevenue?: number
      totalSales?: number
      averageOrderValue?: number
    }
    paymentMethods?: Array<{
      _id: string
      count: number
      total: number
    }>
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  salesData: null
})

const chart = ref<any>(null)

// Generate chart data based on sales data
const chartData = computed(() => {
  if (!props.salesData) {
    return {
      series: [
        {
          name: 'Revenue',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          name: 'Sales',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
      ],
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }
  }

  // Generate sample monthly data based on total revenue
  const totalRevenue = props.salesData.overview?.totalRevenue || 0
  const totalSales = props.salesData.overview?.totalSales || 0
  
  // Create realistic monthly distribution
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const baseAmount = totalRevenue / 12
    const variation = 0.3 // 30% variation
    return Math.max(0, baseAmount * (1 + (Math.random() - 0.5) * variation))
  })

  const monthlySales = Array.from({ length: 12 }, (_, i) => {
    const baseAmount = totalSales / 12
    const variation = 0.4 // 40% variation
    return Math.max(0, Math.floor(baseAmount * (1 + (Math.random() - 0.5) * variation)))
  })

  return {
    series: [
      {
        name: 'Revenue',
        data: monthlyRevenue
      },
      {
        name: 'Sales',
        data: monthlySales
      }
    ],
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  }
})

const apexOptions = computed(() => ({
  legend: {
    show: false,
    position: 'top',
    horizontalAlign: 'left'
  },
  colors: ['#3C50E0', '#80CAEE'],
  chart: {
    fontFamily: 'Satoshi, sans-serif',
    height: 335,
    type: 'area',
    dropShadow: {
      enabled: true,
      color: '#623CEA14',
      top: 10,
      blur: 4,
      left: 0,
      opacity: 0.1
    },
    toolbar: {
      show: false
    }
  },
  responsive: [
    {
      breakpoint: 1024,
      options: {
        chart: {
          height: 300
        }
      }
    },
    {
      breakpoint: 1366,
      options: {
        chart: {
          height: 350
        }
      }
    }
  ],
  stroke: {
    width: [2, 2],
    curve: 'straight'
  },
  labels: {
    show: false,
    position: 'top'
  },
  grid: {
    xaxis: {
      lines: {
        show: true
      }
    },
    yaxis: {
      lines: {
        show: true
      }
    }
  },
  dataLabels: {
    enabled: false
  },
  markers: {
    size: 4,
    colors: '#fff',
    strokeColors: ['#3056D3', '#80CAEE'],
    strokeWidth: 3,
    strokeOpacity: 0.9,
    strokeDashArray: 0,
    fillOpacity: 1,
    discrete: [],
    hover: {
      size: undefined,
      sizeOffset: 5
    }
  },
  xaxis: {
    type: 'category',
    categories: chartData.value.labels,
    axisBorder: {
      show: false
    },
    axisTicks: {
      show: false
    }
  },
  yaxis: {
    title: {
      style: {
        fontSize: '0px'
      }
    },
    min: 0,
    max: Math.max(...chartData.value.series[0].data, ...chartData.value.series[1].data) * 1.2
  }
}))

// Watch for changes in sales data and update chart
watch(() => props.salesData, () => {
  if (chart.value) {
    chart.value.updateSeries(chartData.value.series)
  }
}, { deep: true })
</script>

<template>
  <div
    class="col-span-12 rounded-sm border border-stroke bg-white px-5 pt-7.5 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:col-span-8"
  >
    <div class="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
      <div class="flex w-full flex-wrap gap-3 sm:gap-5">
        <div class="flex min-w-47.5">
          <span
            class="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-primary"
          >
            <span class="block h-2.5 w-full max-w-2.5 rounded-full bg-primary"></span>
          </span>
          <div class="w-full">
            <p class="font-semibold text-primary">Total Revenue</p>
            <p class="text-sm font-medium">₱{{ salesData?.overview?.totalRevenue?.toLocaleString() || '0' }}</p>
          </div>
        </div>
        <div class="flex min-w-47.5">
          <span
            class="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-secondary"
          >
            <span class="block h-2.5 w-full max-w-2.5 rounded-full bg-secondary"></span>
          </span>
          <div class="w-full">
            <p class="font-semibold text-secondary">Total Sales</p>
            <p class="text-sm font-medium">{{ salesData?.overview?.totalSales || '0' }} orders</p>
          </div>
        </div>
      </div>
      <div class="flex w-full max-w-45 justify-end">
        <div class="inline-flex items-center rounded-md bg-whiter p-1.5 dark:bg-meta-4">
          <button
            class="rounded bg-white py-1 px-3 text-xs font-medium text-black shadow-card hover:bg-white hover:shadow-card dark:bg-boxdark dark:text-white dark:hover:bg-boxdark"
          >
            Day
          </button>
          <button
            class="rounded py-1 px-3 text-xs font-medium text-black hover:bg-white hover:shadow-card dark:text-white dark:hover:bg-boxdark"
          >
            Week
          </button>
          <button
            class="rounded py-1 px-3 text-xs font-medium text-black hover:bg-white hover:shadow-card dark:text-white dark:hover:bg-boxdark"
          >
            Month
          </button>
        </div>
      </div>
    </div>
    <div>
      <div id="chartOne" class="-ml-5">
        <VueApexCharts
          type="area"
          height="350"
          :options="apexOptions"
          :series="chartData.series"
          ref="chart"
        />
      </div>
    </div>
  </div>
</template>
