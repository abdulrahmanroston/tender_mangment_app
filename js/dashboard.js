import { Chart } from "@/components/ui/chart"
import { Utils } from "@/utils/utils" // Declare or import Utils here

// Dashboard functionality
class Dashboard {
  constructor() {
    this.charts = {}
    this.init()
  }

  async init() {
    Utils.showLoading(true)
    try {
      await this.loadDashboardData()
      this.setupCharts()
      this.setupEventListeners()
    } catch (error) {
      console.error("Dashboard initialization error:", error)
      Utils.showNotification("Failed to load dashboard data", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  async loadDashboardData() {
    try {
      // Load recent orders
      const recentOrders = await window.api.getOrders({
        per_page: 10,
        orderby: "date",
        order: "desc",
      })

      // Load today's orders
      const today = new Date().toISOString().split("T")[0]
      const todayOrders = await window.api.getOrdersByDateRange(today, today)

      // Load products for low stock check
      const products = await window.api.getProducts({ per_page: 100 })
      const lowStockProducts = await window.api.getProductsLowStock(10)

      // Update stats
      this.updateStats(todayOrders, recentOrders, lowStockProducts)

      // Update recent orders table
      this.updateRecentOrdersTable(recentOrders)

      // Load chart data
      await this.loadChartData()
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      throw error
    }
  }

  updateStats(todayOrders, allOrders, lowStockProducts) {
    // Today's orders count
    document.getElementById("todayOrders").textContent = todayOrders.length

    // Today's revenue
    const todayRevenue = todayOrders.reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)
    document.getElementById("todayRevenue").textContent = Utils.formatCurrency(todayRevenue)

    // Low stock items
    document.getElementById("lowStockItems").textContent = lowStockProducts.length

    // Active customers (unique customers from recent orders)
    const uniqueCustomers = new Set(allOrders.map((order) => order.customer_id).filter((id) => id > 0))
    document.getElementById("activeCustomers").textContent = uniqueCustomers.size
  }

  updateRecentOrdersTable(orders) {
    const tbody = document.getElementById("recentOrdersTable")
    if (!tbody) return

    tbody.innerHTML = orders
      .slice(0, 5)
      .map((order) => {
        const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"
        const statusColor = Utils.getStatusColor(order.status)

        return `
                <tr>
                    <td>#${order.id}</td>
                    <td>${customerName}</td>
                    <td>
                        <span class="status-badge" style="background-color: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem;">
                            ${Utils.getStatusLabel(order.status)}
                        </span>
                    </td>
                    <td>${Utils.formatCurrency(order.total)}</td>
                    <td>${Utils.formatDate(order.date_created)}</td>
                    <td>
                        <button class="btn btn-primary" onclick="viewOrder(${order.id})" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            View
                        </button>
                    </td>
                </tr>
            `
      })
      .join("")
  }

  async loadChartData() {
    try {
      // Get sales data for the last 7 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 7)

      const salesData = await this.getSalesDataByDate(startDate, endDate)
      const statusData = await this.getOrderStatusData()

      this.updateSalesChart(salesData)
      this.updateStatusChart(statusData)
    } catch (error) {
      console.error("Error loading chart data:", error)
    }
  }

  async getSalesDataByDate(startDate, endDate) {
    const data = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]
      try {
        const orders = await window.api.getOrdersByDateRange(dateStr, dateStr)
        const revenue = orders.reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)

        data.push({
          date: dateStr,
          revenue: revenue,
          orders: orders.length,
        })
      } catch (error) {
        console.error(`Error getting data for ${dateStr}:`, error)
        data.push({
          date: dateStr,
          revenue: 0,
          orders: 0,
        })
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return data
  }

  async getOrderStatusData() {
    try {
      const orders = await window.api.getOrders({ per_page: 100 })
      const statusCounts = {}

      orders.forEach((order) => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1
      })

      return Object.entries(statusCounts).map(([status, count]) => ({
        status: Utils.getStatusLabel(status),
        count: count,
        color: Utils.getStatusColor(status),
      }))
    } catch (error) {
      console.error("Error getting status data:", error)
      return []
    }
  }

  setupCharts() {
    // Sales Chart
    const salesCtx = document.getElementById("salesChart")
    if (salesCtx) {
      this.charts.sales = new Chart(salesCtx, {
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
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => "EGP " + value,
              },
            },
          },
        },
      })
    }

    // Status Chart
    const statusCtx = document.getElementById("statusChart")
    if (statusCtx) {
      this.charts.status = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [],
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
  }

  updateSalesChart(data) {
    if (!this.charts.sales) return

    const labels = data.map((item) => {
      const date = new Date(item.date)
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    })
    const revenues = data.map((item) => item.revenue)

    this.charts.sales.data.labels = labels
    this.charts.sales.data.datasets[0].data = revenues
    this.charts.sales.update()
  }

  updateStatusChart(data) {
    if (!this.charts.status) return

    this.charts.status.data.labels = data.map((item) => item.status)
    this.charts.status.data.datasets[0].data = data.map((item) => item.count)
    this.charts.status.data.datasets[0].backgroundColor = data.map((item) => item.color)
    this.charts.status.update()
  }

  setupEventListeners() {
    // Sales period selector
    const salesPeriod = document.getElementById("salesPeriod")
    if (salesPeriod) {
      salesPeriod.addEventListener("change", async (e) => {
        const days = Number.parseInt(e.target.value)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)

        Utils.showLoading(true)
        try {
          const salesData = await this.getSalesDataByDate(startDate, endDate)
          this.updateSalesChart(salesData)
        } catch (error) {
          console.error("Error updating sales chart:", error)
          Utils.showNotification("Failed to update chart", "error")
        } finally {
          Utils.showLoading(false)
        }
      })
    }
  }
}

// Global function to view order
function viewOrder(orderId) {
  window.location.href = `orders.html?order=${orderId}`
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
  new Dashboard()
})
