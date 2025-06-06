import { Chart } from "@/components/ui/chart"
// Analytics and reports functionality
class AnalyticsManager {
  constructor() {
    this.charts = {}
    this.dateRange = 30 // Default to 30 days
    this.customDateFrom = null
    this.customDateTo = null
    this.init()
  }

  async init() {
    Utils.showLoading(true)
    try {
      this.setupEventListeners()
      await this.loadAnalyticsData()
      this.setupCharts()
    } catch (error) {
      console.error("Analytics initialization error:", error)
      Utils.showNotification("Failed to load analytics data", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  setupEventListeners() {
    // Date range selector
    const dateRangeSelect = document.getElementById("dateRange")
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener("change", async (e) => {
        const value = e.target.value
        if (value === "custom") {
          // Show custom date picker
          const fromDate = prompt("Enter start date (YYYY-MM-DD):")
          const toDate = prompt("Enter end date (YYYY-MM-DD):")

          if (fromDate && toDate) {
            this.customDateFrom = fromDate
            this.customDateTo = toDate
            await this.loadAnalyticsData()
          } else {
            dateRangeSelect.value = this.dateRange
          }
        } else {
          this.dateRange = Number.parseInt(value)
          this.customDateFrom = null
          this.customDateTo = null
          await this.loadAnalyticsData()
        }
      })
    }

    // Chart type buttons
    document.querySelectorAll(".chart-type-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const chartType = e.target.dataset.type
        const chartButtons = e.target.closest(".chart-controls").querySelectorAll(".chart-type-btn")

        chartButtons.forEach((button) => button.classList.remove("active"))
        e.target.classList.add("active")

        this.updateChartType("revenue", chartType)
      })
    })
  }

  async loadAnalyticsData() {
    Utils.showLoading(true)
    try {
      // Calculate date range
      let startDate, endDate

      if (this.customDateFrom && this.customDateTo) {
        startDate = new Date(this.customDateFrom)
        endDate = new Date(this.customDateTo)
      } else {
        endDate = new Date()
        startDate = new Date()
        startDate.setDate(endDate.getDate() - this.dateRange)
      }

      // Load orders within date range
      const orders = await this.getOrdersByDateRange(startDate, endDate)

      // Calculate KPIs
      this.calculateKPIs(orders, startDate, endDate)

      // Prepare chart data
      const revenueData = await this.prepareRevenueData(orders, startDate, endDate)
      const statusData = this.prepareStatusData(orders)
      const productData = this.prepareProductData(orders)
      const warehouseData = this.prepareWarehouseData(orders)
      const customerData = this.prepareCustomerData(orders)

      // Update charts
      this.updateCharts(revenueData, statusData, productData, warehouseData, customerData)

      // Update report tables
      this.updateReportTables(orders)
    } catch (error) {
      console.error("Error loading analytics data:", error)
      Utils.showNotification("Failed to load analytics data", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  async getOrdersByDateRange(startDate, endDate) {
    try {
      const formattedStartDate = startDate.toISOString()
      const formattedEndDate = endDate.toISOString()

      return await window.api.getOrders({
        after: formattedStartDate,
        before: formattedEndDate,
        per_page: 100,
      })
    } catch (error) {
      console.error("Error fetching orders by date range:", error)
      return []
    }
  }

  calculateKPIs(orders, startDate, endDate) {
    // Calculate total revenue
    const totalRevenue = orders.reduce((sum, order) => {
      if (["completed", "processing", "on-hold", "on-delivery"].includes(order.status)) {
        return sum + Number.parseFloat(order.total)
      }
      return sum
    }, 0)

    // Calculate average order value
    const validOrders = orders.filter((order) =>
      ["completed", "processing", "on-hold", "on-delivery"].includes(order.status),
    )
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0

    // Count unique customers
    const customerIds = new Set(orders.map((order) => order.customer_id).filter((id) => id > 0))
    const newCustomers = customerIds.size

    // Get previous period for comparison
    const periodLength = (endDate - startDate) / (1000 * 60 * 60 * 24)
    const prevStartDate = new Date(startDate)
    const prevEndDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodLength)

    // Load previous period data for comparison
    this.getOrdersByDateRange(prevStartDate, prevEndDate).then((prevOrders) => {
      const prevRevenue = prevOrders.reduce((sum, order) => {
        if (["completed", "processing", "on-hold", "on-delivery"].includes(order.status)) {
          return sum + Number.parseFloat(order.total)
        }
        return sum
      }, 0)

      const prevValidOrders = prevOrders.filter((order) =>
        ["completed", "processing", "on-hold", "on-delivery"].includes(order.status),
      )
      const prevAvgOrderValue = prevValidOrders.length > 0 ? prevRevenue / prevValidOrders.length : 0

      const prevCustomerIds = new Set(prevOrders.map((order) => order.customer_id).filter((id) => id > 0))

      // Calculate percentage changes
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 100
      const ordersChange =
        prevValidOrders.length > 0
          ? ((validOrders.length - prevValidOrders.length) / prevValidOrders.length) * 100
          : 100
      const aovChange = prevAvgOrderValue > 0 ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100 : 100
      const customersChange =
        prevCustomerIds.size > 0 ? ((newCustomers - prevCustomerIds.size) / prevCustomerIds.size) * 100 : 100

      // Update KPI displays
      document.getElementById("totalRevenue").textContent = Utils.formatCurrency(totalRevenue)
      document.getElementById("totalOrdersKpi").textContent = validOrders.length
      document.getElementById("avgOrderValue").textContent = Utils.formatCurrency(avgOrderValue)
      document.getElementById("newCustomers").textContent = newCustomers

      document.getElementById("revenueChange").textContent =
        `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`
      document.getElementById("revenueChange").className = `kpi-change ${revenueChange >= 0 ? "positive" : "negative"}`

      document.getElementById("ordersChange").textContent = `${ordersChange >= 0 ? "+" : ""}${ordersChange.toFixed(1)}%`
      document.getElementById("ordersChange").className = `kpi-change ${ordersChange >= 0 ? "positive" : "negative"}`

      document.getElementById("aovChange").textContent = `${aovChange >= 0 ? "+" : ""}${aovChange.toFixed(1)}%`
      document.getElementById("aovChange").className = `kpi-change ${aovChange >= 0 ? "positive" : "negative"}`

      document.getElementById("customersChange").textContent =
        `${customersChange >= 0 ? "+" : ""}${customersChange.toFixed(1)}%`
      document.getElementById("customersChange").className =
        `kpi-change ${customersChange >= 0 ? "positive" : "negative"}`
    })
  }

  async prepareRevenueData(orders, startDate, endDate) {
    // Group orders by date
    const dateFormat = { month: "short", day: "numeric" }
    const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24))
    const data = []

    // Create array of all dates in range
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]

      // Filter orders for this date
      const dateOrders = orders.filter((order) => {
        const orderDate = new Date(order.date_created)
        return orderDate.toISOString().split("T")[0] === dateStr
      })

      // Calculate revenue for this date
      const revenue = dateOrders.reduce((sum, order) => {
        if (["completed", "processing", "on-hold", "on-delivery"].includes(order.status)) {
          return sum + Number.parseFloat(order.total)
        }
        return sum
      }, 0)

      data.push({
        date: date.toLocaleDateString("en-US", dateFormat),
        revenue: revenue,
        orders: dateOrders.length,
      })
    }

    return data
  }

  prepareStatusData(orders) {
    // Count orders by status
    const statusCounts = {}

    orders.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1
    })

    // Format for chart
    return Object.entries(statusCounts).map(([status, count]) => ({
      status: Utils.getStatusLabel(status),
      count: count,
      color: Utils.getStatusColor(status),
    }))
  }

  prepareProductData(orders) {
    // Count product sales
    const productSales = {}

    orders.forEach((order) => {
      order.line_items.forEach((item) => {
        const productId = item.product_id
        const productName = item.name
        const quantity = item.quantity
        const total = Number.parseFloat(item.total)

        if (!productSales[productId]) {
          productSales[productId] = {
            name: productName,
            quantity: 0,
            revenue: 0,
          }
        }

        productSales[productId].quantity += quantity
        productSales[productId].revenue += total
      })
    })

    // Convert to array and sort by quantity
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
  }

  prepareWarehouseData(orders) {
    // Count sales by warehouse
    const warehouseSales = {
      oraby: { name: "Oraby", orders: 0, revenue: 0 },
      lavista: { name: "Lavista", orders: 0, revenue: 0 },
      manufacturing: { name: "Manufacturing", orders: 0, revenue: 0 },
      giza: { name: "Giza", orders: 0, revenue: 0 },
    }

    orders.forEach((order) => {
      const warehouse = Utils.getMetaValue(order.meta_data, "_selected_warehouse")
      if (warehouse && warehouseSales[warehouse]) {
        warehouseSales[warehouse].orders += 1
        warehouseSales[warehouse].revenue += Number.parseFloat(order.total)
      }
    })

    return Object.values(warehouseSales)
  }

  prepareCustomerData(orders) {
    // Group orders by customer
    const customerOrders = {}

    orders.forEach((order) => {
      const customerId = order.customer_id || 0
      const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"

      if (!customerOrders[customerId]) {
        customerOrders[customerId] = {
          name: customerName,
          orders: 0,
          total: 0,
        }
      }

      customerOrders[customerId].orders += 1
      customerOrders[customerId].total += Number.parseFloat(order.total)
    })

    // Convert to array and sort by total spent
    return Object.values(customerOrders)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }

  setupCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById("revenueChart")
    if (revenueCtx) {
      this.charts.revenue = new Chart(revenueCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Revenue",
              data: [],
              borderColor: "#1a73e8",
              backgroundColor: "rgba(26, 115, 232, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `Revenue: ${Utils.formatCurrency(context.raw)}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => Utils.formatCurrency(value),
              },
            },
          },
        },
      })
    }

    // Order Status Chart
    const statusCtx = document.getElementById("orderStatusChart")
    if (statusCtx) {
      this.charts.status = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      })
    }

    // Top Products Chart
    const productsCtx = document.getElementById("topProductsChart")
    if (productsCtx) {
      this.charts.products = new Chart(productsCtx, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "Units Sold",
              data: [],
              backgroundColor: "rgba(16, 185, 129, 0.7)",
              borderColor: "rgb(16, 185, 129)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      })
    }

    // Warehouse Sales Chart
    const warehouseCtx = document.getElementById("warehouseSalesChart")
    if (warehouseCtx) {
      this.charts.warehouse = new Chart(warehouseCtx, {
        type: "pie",
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [
                "rgba(26, 115, 232, 0.7)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(245, 158, 11, 0.7)",
                "rgba(239, 68, 68, 0.7)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      })
    }

    // Customer Growth Chart
    const customerCtx = document.getElementById("customerGrowthChart")
    if (customerCtx) {
      this.charts.customer = new Chart(customerCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "New Customers",
              data: [],
              borderColor: "#8b5cf6",
              backgroundColor: "rgba(139, 92, 246, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      })
    }
  }

  updateCharts(revenueData, statusData, productData, warehouseData, customerData) {
    // Update Revenue Chart
    if (this.charts.revenue) {
      this.charts.revenue.data.labels = revenueData.map((item) => item.date)
      this.charts.revenue.data.datasets[0].data = revenueData.map((item) => item.revenue)
      this.charts.revenue.update()
    }

    // Update Status Chart
    if (this.charts.status) {
      this.charts.status.data.labels = statusData.map((item) => item.status)
      this.charts.status.data.datasets[0].data = statusData.map((item) => item.count)
      this.charts.status.data.datasets[0].backgroundColor = statusData.map((item) => item.color)
      this.charts.status.update()
    }

    // Update Products Chart
    if (this.charts.products) {
      this.charts.products.data.labels = productData.map((item) => item.name)
      this.charts.products.data.datasets[0].data = productData.map((item) => item.quantity)
      this.charts.products.update()
    }

    // Update Warehouse Chart
    if (this.charts.warehouse) {
      this.charts.warehouse.data.labels = warehouseData.map((item) => item.name)
      this.charts.warehouse.data.datasets[0].data = warehouseData.map((item) => item.revenue)
      this.charts.warehouse.update()
    }

    // Update Customer Chart - simplified version
    if (this.charts.customer) {
      // For simplicity, we'll just use the same revenue data dates
      this.charts.customer.data.labels = revenueData.map((item) => item.date)

      // Generate some dummy growth data based on orders
      const growthData = revenueData.map((item) => Math.max(0, Math.floor(item.orders * 0.3)))
      this.charts.customer.data.datasets[0].data = growthData
      this.charts.customer.update()
    }
  }

  updateChartType(chartName, type) {
    if (!this.charts[chartName]) return

    this.charts[chartName].config.type = type
    this.charts[chartName].update()
  }

  updateReportTables(orders) {
    // Update Top Products Table
    const productData = this.prepareProductData(orders)
    const topProductsTable = document.getElementById("topProductsTable")

    if (topProductsTable) {
      const tbody = topProductsTable.querySelector("tbody")
      tbody.innerHTML = productData
        .map(
          (product) => `
        <tr>
          <td>${product.name}</td>
          <td>${product.quantity}</td>
          <td>${Utils.formatCurrency(product.revenue)}</td>
        </tr>
      `,
        )
        .join("")
    }

    // Update Customer Analysis Table
    const customerData = this.prepareCustomerData(orders)
    const customerTable = document.getElementById("customerAnalysisTable")

    if (customerTable) {
      const tbody = customerTable.querySelector("tbody")
      tbody.innerHTML = customerData
        .map(
          (customer) => `
        <tr>
          <td>${customer.name}</td>
          <td>${customer.orders}</td>
          <td>${Utils.formatCurrency(customer.total)}</td>
        </tr>
      `,
        )
        .join("")
    }
  }

  exportReport() {
    const dateRange = document.getElementById("dateRange").value
    const rangeText =
      dateRange === "custom" ? `${this.customDateFrom}_to_${this.customDateTo}` : `last_${dateRange}_days`

    const data = []

    // Get data from top products table
    const productsTable = document.getElementById("topProductsTable")
    if (productsTable) {
      const rows = productsTable.querySelectorAll("tbody tr")
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td")
        data.push({
          type: "product",
          name: cells[0].textContent,
          quantity: cells[1].textContent,
          revenue: cells[2].textContent,
        })
      })
    }

    // Get data from customer analysis table
    const customerTable = document.getElementById("customerAnalysisTable")
    if (customerTable) {
      const rows = customerTable.querySelectorAll("tbody tr")
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td")
        data.push({
          type: "customer",
          name: cells[0].textContent,
          orders: cells[1].textContent,
          spent: cells[2].textContent,
        })
      })
    }

    // Export to CSV
    Utils.exportToCSV(data, `analytics_report_${rangeText}`)
  }

  exportTopProducts() {
    const data = []
    const table = document.getElementById("topProductsTable")

    if (table) {
      const rows = table.querySelectorAll("tbody tr")
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td")
        data.push({
          product: cells[0].textContent,
          quantity: cells[1].textContent,
          revenue: cells[2].textContent,
        })
      })
    }

    Utils.exportToCSV(data, "top_products_report")
  }

  exportCustomerAnalysis() {
    const data = []
    const table = document.getElementById("customerAnalysisTable")

    if (table) {
      const rows = table.querySelectorAll("tbody tr")
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td")
        data.push({
          customer: cells[0].textContent,
          orders: cells[1].textContent,
          total_spent: cells[2].textContent,
        })
      })
    }

    Utils.exportToCSV(data, "customer_analysis_report")
  }
}

// Global functions
function exportReport() {
  if (window.analyticsManager) {
    window.analyticsManager.exportReport()
  }
}

function exportTopProducts() {
  if (window.analyticsManager) {
    window.analyticsManager.exportTopProducts()
  }
}

function exportCustomerAnalysis() {
  if (window.analyticsManager) {
    window.analyticsManager.exportCustomerAnalysis()
  }
}

// Initialize analytics manager
document.addEventListener("DOMContentLoaded", () => {
  window.analyticsManager = new AnalyticsManager()
})
