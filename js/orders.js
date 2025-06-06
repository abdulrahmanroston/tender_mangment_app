// Orders management functionality
class OrdersManager {
  constructor() {
    this.orders = []
    this.filteredOrders = []
    this.currentPage = 1
    this.perPage = 25 // Default, will be updated from settings
    this.filters = {
      status: [],
      dateRange: "all",
      customDateFrom: "",
      customDateTo: "",
      search: "",
    }
    this.init()
  }

  async init() {
    this.loadSettings()
    this.setupEventListeners()
    await this.loadOrders()
    this.updateStats()
  }

  loadSettings() {
    // Get settings from localStorage
    const settings = Utils.getSettings()
    if (settings && settings.ordersPerPage) {
      this.perPage = Number.parseInt(settings.ordersPerPage) || 25
    }
  }

  setupEventListeners() {
    // Filter toggle
    const filterToggle = document.getElementById("filterToggle")
    const filtersPanel = document.getElementById("filtersPanel")
    const closeFilters = document.getElementById("closeFilters")

    if (filterToggle && filtersPanel) {
      filterToggle.addEventListener("click", () => {
        filtersPanel.classList.toggle("active")
      })
    }

    if (closeFilters && filtersPanel) {
      closeFilters.addEventListener("click", () => {
        filtersPanel.classList.remove("active")
      })
    }

    // Date filter buttons
    document.querySelectorAll(".date-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".date-filter-btn").forEach((b) => b.classList.remove("active"))
        e.target.classList.add("active")

        const filter = e.target.dataset.filter
        this.filters.dateRange = filter

        const customRange = document.getElementById("customDateRange")
        if (filter === "custom") {
          customRange.style.display = "flex"
        } else {
          customRange.style.display = "none"
        }
      })
    })

    // Search input
    const customerSearch = document.getElementById("customerSearch")
    if (customerSearch) {
      customerSearch.addEventListener(
        "input",
        Utils.debounce((e) => {
          this.filters.search = e.target.value
          this.applyFilters()
        }, 500),
      )
    }

    // Status checkboxes
    document.querySelectorAll('input[type="checkbox"][value]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateStatusFilters()
      })
    })

    // Date inputs
    const dateFrom = document.getElementById("dateFrom")
    const dateTo = document.getElementById("dateTo")

    if (dateFrom) {
      dateFrom.addEventListener("change", (e) => {
        this.filters.customDateFrom = e.target.value
      })
    }

    if (dateTo) {
      dateTo.addEventListener("change", (e) => {
        this.filters.customDateTo = e.target.value
      })
    }
  }

  updateStatusFilters() {
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"][value]:checked')
    this.filters.status = Array.from(checkedBoxes).map((cb) => cb.value)
  }

  async loadOrders() {
    Utils.showLoading(true)
    try {
      const params = {
        per_page: 100,
        orderby: "date",
        order: "desc",
      }

      this.orders = await window.api.getOrders(params)
      this.filteredOrders = [...this.orders]
      this.renderOrders()
      this.updateStats()
    } catch (error) {
      console.error("Error loading orders:", error)
      Utils.showNotification("Failed to load orders", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  applyFilters() {
    this.filteredOrders = this.orders.filter((order) => {
      // Status filter
      if (this.filters.status.length > 0 && !this.filters.status.includes(order.status)) {
        return false
      }

      // Date filter
      if (this.filters.dateRange !== "all") {
        const orderDate = new Date(order.date_created)
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(today.getDate() + 1)

        const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date")
        const deliveryDateObj = deliveryDate ? new Date(deliveryDate) : orderDate

        switch (this.filters.dateRange) {
          case "today":
            if (deliveryDateObj.toDateString() !== today.toDateString()) return false
            break
          case "tomorrow":
            if (deliveryDateObj.toDateString() !== tomorrow.toDateString()) return false
            break
          case "later":
            if (deliveryDateObj <= tomorrow) return false
            break
          case "custom":
            if (this.filters.customDateFrom && deliveryDateObj < new Date(this.filters.customDateFrom)) return false
            if (this.filters.customDateTo && deliveryDateObj > new Date(this.filters.customDateTo)) return false
            break
        }
      }

      // Search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase()
        const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.toLowerCase()
        const email = (order.billing.email || "").toLowerCase()
        const phone = (order.billing.phone || "").toLowerCase()

        if (
          !customerName.includes(searchTerm) &&
          !email.includes(searchTerm) &&
          !phone.includes(searchTerm) &&
          !order.id.toString().includes(searchTerm)
        ) {
          return false
        }
      }

      return true
    })

    this.currentPage = 1 // Reset to first page when filtering
    this.renderOrders()
    this.updateStats()
  }

  renderOrders() {
    const ordersGrid = document.getElementById("ordersGrid")
    if (!ordersGrid) return

    if (this.filteredOrders.length === 0) {
      ordersGrid.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No orders found matching your criteria</p>
                </div>
            `
      return
    }

    const ordersToShow = this.filteredOrders.slice(0, this.currentPage * this.perPage)

    ordersGrid.innerHTML = ordersToShow.map((order) => this.createOrderCard(order)).join("")

    // Update load more button
    const loadMoreBtn = document.getElementById("loadMoreBtn")
    if (loadMoreBtn) {
      if (ordersToShow.length >= this.filteredOrders.length) {
        loadMoreBtn.style.display = "none"
      } else {
        loadMoreBtn.style.display = "block"
      }
    }
  }

  createOrderCard(order) {
    const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"
    const statusColor = Utils.getStatusColor(order.status)
    const statusLabel = Utils.getStatusLabel(order.status)
    const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date") || "Not set"
    const deliveryTime = Utils.getMetaValue(order.meta_data, "order_time") || "Not set"
    const warehouse = Utils.getMetaValue(order.meta_data, "_selected_warehouse") || "Not specified"

    return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <span class="order-id">#${order.id}</span>
                    <span class="order-status" style="background-color: ${statusColor};">${statusLabel}</span>
                </div>
                <div class="order-info">
                    <div><strong>Customer:</strong> ${customerName}</div>
                    <div><strong>Total:</strong> ${Utils.formatCurrency(order.total)}</div>
                    <div><strong>Date:</strong> ${Utils.formatDate(order.date_created)}</div>
                    <div><strong>Delivery:</strong> ${deliveryDate}</div>
                    <div><strong>Time:</strong> ${deliveryTime}</div>
                    <div><strong>Warehouse:</strong> ${warehouse}</div>
                </div>
                <div class="order-actions">
                    <button class="edit-btn" onclick="openEditOrderModal(${order.id}, event)">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="whatsapp-btn" onclick="sendOrderToWhatsApp(${order.id}, event)">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
                <div class="order-details" id="details-${order.id}" style="display: none;">
                    <div class="order-products">
                        <h4>Products</h4>
                        <ul>
                            ${order.line_items
                              .map(
                                (item) => `
                                <li>
                                    <span class="product-name">${item.name}</span>
                                    <span class="product-qty">x${item.quantity}</span>
                                    <span class="product-price">${Utils.formatCurrency(item.total)}</span>
                                </li>
                            `,
                              )
                              .join("")}
                        </ul>
                    </div>
                    <div class="order-buttons">
                        <button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'processing', event)">
                            <i class="fas fa-check"></i> Process
                        </button>
                        <button class="btn btn-info" onclick="updateOrderStatus(${order.id}, 'on-delivery', event)">
                            <i class="fas fa-truck"></i> Delivery
                        </button>
                        <button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'completed', event)">
                            <i class="fas fa-check-double"></i> Complete
                        </button>
                        <button class="btn btn-danger" onclick="updateOrderStatus(${order.id}, 'cancelled', event)">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            </div>
        `
  }

  updateStats() {
    const today = new Date().toDateString()
    const todayOrders = this.filteredOrders.filter((order) => {
      const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date")
      return deliveryDate ? new Date(deliveryDate).toDateString() === today : false
    })

    const pendingOrders = this.filteredOrders.filter((order) =>
      ["pending", "processing", "on-hold"].includes(order.status),
    )

    const deliveryOrders = this.filteredOrders.filter((order) => order.status === "on-delivery")

    document.getElementById("totalOrders").textContent = this.filteredOrders.length
    document.getElementById("todayOrdersCount").textContent = todayOrders.length
    document.getElementById("pendingOrders").textContent = pendingOrders.length
    document.getElementById("deliveryOrders").textContent = deliveryOrders.length
  }

  async updateOrderStatus(orderId, newStatus, additionalData = {}) {
    Utils.showLoading(true)
    try {
      const updateData = {
        status: newStatus,
        ...additionalData,
      }

      await window.api.updateOrder(orderId, updateData)
      await this.loadOrders()
      Utils.showNotification("Order status updated successfully", "success")
    } catch (error) {
      console.error("Error updating order status:", error)
      Utils.showNotification("Failed to update order status", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  toggleOrderDetails(orderId) {
    const detailsElement = document.getElementById(`details-${orderId}`)
    if (detailsElement) {
      const isVisible = detailsElement.style.display !== "none"
      detailsElement.style.display = isVisible ? "none" : "block"

      // Add active class to the order card
      const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`)
      if (orderCard) {
        if (isVisible) {
          orderCard.classList.remove("expanded")
        } else {
          orderCard.classList.add("expanded")
        }
      }
    }
  }
}

// Global functions
function refreshOrders() {
  if (window.ordersManager) {
    window.ordersManager.loadOrders()
  }
}

function applyFilters() {
  if (window.ordersManager) {
    window.ordersManager.applyFilters()
    document.getElementById("filtersPanel").classList.remove("active")
  }
}

function clearFilters() {
  // Reset all filter inputs
  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false))
  document.getElementById("customerSearch").value = ""
  document.getElementById("dateFrom").value = ""
  document.getElementById("dateTo").value = ""

  // Reset date filter buttons
  document.querySelectorAll(".date-filter-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelector('.date-filter-btn[data-filter="all"]').classList.add("active")

  // Reset filters object
  if (window.ordersManager) {
    window.ordersManager.filters = {
      status: [],
      dateRange: "all",
      customDateFrom: "",
      customDateTo: "",
      search: "",
    }
    window.ordersManager.applyFilters()
  }

  document.getElementById("filtersPanel").classList.remove("active")
}

function loadMoreOrders() {
  if (window.ordersManager) {
    window.ordersManager.currentPage++
    window.ordersManager.renderOrders()
  }
}

async function openOrderModal(orderId) {
  Utils.showLoading(true)
  try {
    const order = await window.api.getOrder(orderId)
    const modal = document.getElementById("orderModal")
    const modalTitle = document.getElementById("modalTitle")
    const modalBody = document.getElementById("modalBody")

    modalTitle.textContent = `Order #${order.id} Details`
    modalBody.innerHTML = generateOrderDetailsHTML(order)
    modal.classList.add("active")
  } catch (error) {
    console.error("Error loading order details:", error)
    Utils.showNotification("Failed to load order details", "error")
  } finally {
    Utils.showLoading(false)
  }
}

function generateOrderDetailsHTML(order) {
  const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"
  const products = order.line_items
    .map(
      (item) => `
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <span>${item.name} x${item.quantity}</span>
            <span>${Utils.formatCurrency(item.total)}</span>
        </div>
    `,
    )
    .join("")

  return `
        <div style="display: grid; gap: 1rem;">
            <div>
                <h4>Customer Information</h4>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${order.billing.email || "N/A"}</p>
                <p><strong>Phone:</strong> ${order.billing.phone || "N/A"}</p>
                <p><strong>Address:</strong> ${order.billing.address_1 || "N/A"}</p>
            </div>
            
            <div>
                <h4>Order Information</h4>
                <p><strong>Status:</strong> ${Utils.getStatusLabel(order.status)}</p>
                <p><strong>Date:</strong> ${Utils.formatDateTime(order.date_created)}</p>
                <p><strong>Total:</strong> ${Utils.formatCurrency(order.total)}</p>
                <p><strong>Payment Method:</strong> ${order.payment_method_title || "N/A"}</p>
            </div>
            
            <div>
                <h4>Products</h4>
                ${products}
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn btn-primary" onclick="openEditOrderModal(${order.id})">
                    <i class="fas fa-edit"></i> Edit Order
                </button>
                <button class="btn btn-success" onclick="sendOrderToWhatsApp(${order.id})">
                    <i class="fab fa-whatsapp"></i> Send to WhatsApp
                </button>
            </div>
        </div>
    `
}

function closeOrderModal() {
  document.getElementById("orderModal").classList.remove("active")
}

function openEditOrderModal(orderId, event) {
  if (event) {
    event.stopPropagation()
  }

  // Implementation for edit order modal
  Utils.showNotification("Edit order functionality coming soon", "info")
}

function closeEditOrderModal() {
  document.getElementById("editOrderModal").classList.remove("active")
}

async function sendOrderToWhatsApp(orderId, event) {
  if (event) {
    event.stopPropagation()
  }

  try {
    const order = await window.api.getOrder(orderId)
    const message = Utils.generateWhatsAppMessage(order, "invoice")
    const phone = Utils.formatPhoneNumber(order.billing.phone)

    if (phone) {
      Utils.openWhatsApp(phone, message)
    } else {
      Utils.showNotification("No phone number found for this customer", "warning")
    }
  } catch (error) {
    console.error("Error sending to WhatsApp:", error)
    Utils.showNotification("Failed to send to WhatsApp", "error")
  }
}

function toggleOrderDetails(orderId) {
  if (window.ordersManager) {
    window.ordersManager.toggleOrderDetails(orderId)
  }
}

async function updateOrderStatus(orderId, newStatus, event) {
  if (event) {
    event.stopPropagation()
  }

  if (window.ordersManager) {
    await window.ordersManager.updateOrderStatus(orderId, newStatus)
  }
}

// Initialize orders manager
document.addEventListener("DOMContentLoaded", () => {
  window.ordersManager = new OrdersManager()

  // Add click event listener to order cards for expanding
  document.addEventListener("click", (e) => {
    const orderCard = e.target.closest(".order-card")
    if (orderCard && !e.target.closest(".order-actions") && !e.target.closest(".order-details")) {
      const orderId = orderCard.dataset.orderId
      if (orderId) {
        toggleOrderDetails(orderId)
      }
    }
  })
})

// Utils functions
function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

function showLoading(isLoading) {
  const loadingElement = document.getElementById("loading")
  if (loadingElement) {
    loadingElement.style.display = isLoading ? "block" : "none"
  }
}

function showNotification(message, type) {
  const notificationElement = document.getElementById("notification")
  if (notificationElement) {
    notificationElement.textContent = message
    notificationElement.classList.remove("success", "error", "info", "warning")
    notificationElement.classList.add(type)
    notificationElement.style.display = "block"
    setTimeout(() => {
      notificationElement.style.display = "none"
    }, 3000)
  }
}

function getMetaValue(metaData, key) {
  const meta = metaData.find((item) => item.key === key)
  return meta ? meta.value : null
}

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "#FFC107"
    case "processing":
      return "#28A745"
    case "on-hold":
      return "#6C757D"
    case "on-delivery":
      return "#007BFF"
    default:
      return "#DC3545"
  }
}

function getStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Pending"
    case "processing":
      return "Processing"
    case "on-hold":
      return "On Hold"
    case "on-delivery":
      return "On Delivery"
    default:
      return "Cancelled"
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}

function formatDateTime(date) {
  return new Date(date).toLocaleString()
}

function formatPhoneNumber(phone) {
  return phone.replace(/\D/g, "")
}

function openWhatsApp(phone, message) {
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
}

function generateWhatsAppMessage(order, type) {
  const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"
  const orderTotal = formatCurrency(order.total)
  const orderDate = formatDate(order.date_created)
  const deliveryDate = getMetaValue(order.meta_data, "order_date") || "Not set"
  const deliveryTime = getMetaValue(order.meta_data, "order_time") || "Not set"
  const warehouse = getMetaValue(order.meta_data, "_selected_warehouse") || "Not specified"

  return `
        Order Details:
        Customer: ${customerName}
        Total: ${orderTotal}
        Date: ${orderDate}
        Delivery Date: ${deliveryDate}
        Delivery Time: ${deliveryTime}
        Warehouse: ${warehouse}
    `
}

// Utils functions
const Utils = {
  debounce: (func, wait) => {
    let timeout
    return function (...args) {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), wait)
    }
  },
  showLoading: (isLoading) => {
    const loadingElement = document.getElementById("loading")
    if (loadingElement) {
      loadingElement.style.display = isLoading ? "block" : "none"
    }
  },
  showNotification: (message, type) => {
    const notificationElement = document.getElementById("notification")
    if (notificationElement) {
      notificationElement.textContent = message
      notificationElement.classList.remove("success", "error", "info", "warning")
      notificationElement.classList.add(type)
      notificationElement.style.display = "block"
      setTimeout(() => {
        notificationElement.style.display = "none"
      }, 3000)
    }
  },
  getMetaValue: (metaData, key) => {
    const meta = metaData.find((item) => item.key === key)
    return meta ? meta.value : null
  },
  getStatusColor: (status) => {
    switch (status) {
      case "pending":
        return "#FFC107"
      case "processing":
        return "#28A745"
      case "on-hold":
        return "#6C757D"
      case "on-delivery":
        return "#007BFF"
      default:
        return "#DC3545"
    }
  },
  getStatusLabel: (status) => {
    switch (status) {
      case "pending":
        return "Pending"
      case "processing":
        return "Processing"
      case "on-hold":
        return "On Hold"
      case "on-delivery":
        return "On Delivery"
      default:
        return "Cancelled"
    }
  },
  formatCurrency: (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  },
  formatDate: (date) => {
    return new Date(date).toLocaleDateString()
  },
  formatDateTime: (date) => {
    return new Date(date).toLocaleString()
  },
  formatPhoneNumber: (phone) => {
    return phone.replace(/\D/g, "")
  },
  openWhatsApp: (phone, message) => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
  },
  generateWhatsAppMessage: (order, type) => {
    const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "Guest"
    const orderTotal = Utils.formatCurrency(order.total)
    const orderDate = Utils.formatDate(order.date_created)
    const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date") || "Not set"
    const deliveryTime = Utils.getMetaValue(order.meta_data, "order_time") || "Not set"
    const warehouse = Utils.getMetaValue(order.meta_data, "_selected_warehouse") || "Not specified"

    return `
          Order Details:
          Customer: ${customerName}
          Total: ${orderTotal}
          Date: ${orderDate}
          Delivery Date: ${deliveryDate}
          Delivery Time: ${deliveryTime}
          Warehouse: ${warehouse}
      `
  },
  getSettings: () => {
    try {
      const settings = localStorage.getItem("settings")
      return settings ? JSON.parse(settings) : null
    } catch (error) {
      console.error("Error getting settings from localStorage:", error)
      return null
    }
  },
}
