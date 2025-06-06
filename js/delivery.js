// Delivery management functionality
const Utils = {
  showLoading: (isLoading) => {
    // Implementation for showing loading
  },
  showNotification: (message, type) => {
    // Implementation for showing notification
  },
  getMetaValue: (metaData, key) => {
    // Implementation for getting meta value
  },
  formatCurrency: (amount) => {
    // Implementation for formatting currency
  },
  getStatusColor: (status) => {
    // Implementation for getting status color
  },
  getStatusLabel: (status) => {
    // Implementation for getting status label
  },
  formatPhoneNumber: (phone) => {
    // Implementation for formatting phone number
  },
  openWhatsApp: (phone, message) => {
    // Implementation for opening WhatsApp
  },
  generateWhatsAppMessage: (order, type) => {
    // Implementation for generating WhatsApp message
  },
}

class DeliveryManager {
  constructor() {
    this.deliveryOrders = []
    this.deliveryPersonnel = new Map()
    this.init()
  }

  async init() {
    Utils.showLoading(true)
    try {
      await this.loadDeliveryData()
      this.setupEventListeners()
    } catch (error) {
      console.error("Delivery initialization error:", error)
      Utils.showNotification("فشل في تحميل بيانات التوصيل", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  async loadDeliveryData() {
    try {
      // Load orders with delivery assignments
      const allOrders = await window.api.getOrders({
        per_page: 100,
        orderby: "date",
        order: "desc",
      })

      // Filter orders that have delivery assignments or are in delivery status
      this.deliveryOrders = allOrders.filter((order) => {
        const deliveryName = Utils.getMetaValue(order.meta_data, "delivery_name")
        return (
          (deliveryName && deliveryName.trim() !== "") || order.status === "on-delivery" || order.status === "delivered"
        )
      })

      this.processDeliveryPersonnel()
      this.updateStats()
      this.renderDeliveryPersonnel()
      this.renderDeliveryOrders()
      this.updateDeliveryPersonFilter()
    } catch (error) {
      console.error("Error loading delivery data:", error)
      throw error
    }
  }

  processDeliveryPersonnel() {
    this.deliveryPersonnel.clear()

    this.deliveryOrders.forEach((order) => {
      const deliveryName = Utils.getMetaValue(order.meta_data, "delivery_name")
      const deliveryPhone = Utils.getMetaValue(order.meta_data, "delivery_phone")

      if (deliveryName) {
        if (!this.deliveryPersonnel.has(deliveryName)) {
          this.deliveryPersonnel.set(deliveryName, {
            name: deliveryName,
            phone: deliveryPhone,
            orders: [],
            totalAmount: 0,
            pendingOrders: 0,
            completedOrders: 0,
            onDeliveryOrders: 0,
          })
        }

        const personnel = this.deliveryPersonnel.get(deliveryName)
        personnel.orders.push(order)

        // Calculate total amount for orders that are not completed or cancelled
        if (!["completed", "cancelled", "refunded"].includes(order.status)) {
          personnel.totalAmount += Number.parseFloat(order.total || 0)
        }

        // Count orders by status
        if (order.status === "on-delivery") {
          personnel.onDeliveryOrders++
        } else if (["pending", "processing", "on-hold"].includes(order.status)) {
          personnel.pendingOrders++
        } else if (["completed", "delivered"].includes(order.status)) {
          personnel.completedOrders++
        }
      }
    })
  }

  updateStats() {
    const totalOrders = this.deliveryOrders.length

    const pendingOrders = this.deliveryOrders.filter((order) =>
      ["pending", "processing", "on-hold"].includes(order.status),
    ).length

    const onRouteOrders = this.deliveryOrders.filter((order) => order.status === "on-delivery").length

    // Calculate total amount to be collected (only for on-delivery orders)
    const totalAmount = this.deliveryOrders
      .filter((order) => order.status === "on-delivery")
      .reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)

    document.getElementById("totalDeliveryOrders").textContent = totalOrders
    document.getElementById("pendingDeliveryOrders").textContent = pendingOrders
    document.getElementById("onRouteOrders").textContent = onRouteOrders
    document.getElementById("totalCollectionAmount").textContent = Utils.formatCurrency(totalAmount)
  }

  renderDeliveryPersonnel() {
    const personnelGrid = document.getElementById("personnelGrid")
    if (!personnelGrid) return

    if (this.deliveryPersonnel.size === 0) {
      personnelGrid.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1 / -1;">
          <i class="fas fa-truck" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <p>لا يوجد مندوبين مُعينين حالياً</p>
        </div>
      `
      return
    }

    personnelGrid.innerHTML = Array.from(this.deliveryPersonnel.values())
      .map((personnel) => this.createPersonnelCard(personnel))
      .join("")
  }

  createPersonnelCard(personnel) {
    const initials = personnel.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()

    // Calculate amount to be collected (only for on-delivery orders)
    const pendingAmount = personnel.orders
      .filter((order) => order.status === "on-delivery")
      .reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)

    return `
      <div class="personnel-card">
        <div class="personnel-header">
          <div class="personnel-avatar">${initials}</div>
          <div class="personnel-info">
            <h4>${personnel.name}</h4>
            <p>${personnel.phone || "لا يوجد رقم"}</p>
          </div>
        </div>
        
        <div class="personnel-stats">
          <div class="personnel-stat">
            <span class="number">${personnel.orders.length}</span>
            <span class="label">إجمالي الطلبات</span>
          </div>
          <div class="personnel-stat">
            <span class="number">${personnel.onDeliveryOrders}</span>
            <span class="label">في الطريق</span>
          </div>
          <div class="personnel-stat">
            <span class="number">${Utils.formatCurrency(pendingAmount)}</span>
            <span class="label">للتحصيل</span>
          </div>
        </div>
        
        <div class="personnel-actions">
          <button class="view-orders-btn" onclick="filterByDeliveryPerson('${personnel.name}')">
            <i class="fas fa-list"></i>
            عرض الطلبات
          </button>
          ${
            personnel.phone
              ? `
          <button class="call-btn" onclick="callDeliveryPerson('${personnel.phone}')">
            <i class="fas fa-phone"></i>
            اتصال
          </button>
          `
              : ""
          }
        </div>
      </div>
    `
  }

  renderDeliveryOrders(filterByPerson = null) {
    const ordersGrid = document.getElementById("deliveryOrdersGrid")
    if (!ordersGrid) return

    let ordersToShow = this.deliveryOrders
    if (filterByPerson && filterByPerson !== "all") {
      ordersToShow = this.deliveryOrders.filter(
        (order) => Utils.getMetaValue(order.meta_data, "delivery_name") === filterByPerson,
      )
    }

    if (ordersToShow.length === 0) {
      ordersGrid.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <p>لا توجد طلبات للعرض</p>
        </div>
      `
      return
    }

    ordersGrid.innerHTML = ordersToShow.map((order) => this.createDeliveryOrderCard(order)).join("")
  }

  createDeliveryOrderCard(order) {
    const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "ضيف"
    const statusColor = Utils.getStatusColor(order.status)
    const statusLabel = Utils.getStatusLabel(order.status)
    const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date") || "غير محدد"
    const deliveryTime = Utils.getMetaValue(order.meta_data, "order_time") || "غير محدد"
    const deliveryName = Utils.getMetaValue(order.meta_data, "delivery_name") || ""
    const zone = Utils.getMetaValue(order.meta_data, "zone") || order.billing.city || "غير محدد"
    const address = order.billing.address_1 || "غير محدد"

    // Add special indicator for orders that need collection
    const needsCollection = order.status === "on-delivery"
    const collectionClass = needsCollection ? "needs-collection" : ""

    return `
      <div class="delivery-order-card ${collectionClass}" onclick="openDeliveryOrderModal(${order.id})">
        <div class="delivery-order-header">
          <span class="delivery-order-id">#${order.id}</span>
          <span class="delivery-order-status" style="background-color: ${statusColor};">${statusLabel}</span>
        </div>
        
        <div class="delivery-order-info">
          <div><strong>العميل:</strong> ${customerName}</div>
          <div><strong>المنطقة:</strong> ${zone}</div>
          <div><strong>التاريخ:</strong> ${deliveryDate}</div>
          <div><strong>الوقت:</strong> ${deliveryTime}</div>
          <div><strong>المندوب:</strong> <span class="delivery-person-badge">${deliveryName}</span></div>
          <div><strong>المبلغ:</strong> <span class="collection-amount ${needsCollection ? "pending-collection" : ""}">${Utils.formatCurrency(order.total)}</span></div>
        </div>
        
        <div class="delivery-order-actions" onclick="event.stopPropagation()">
          <button class="update-status-btn" onclick="updateDeliveryOrderStatus(${order.id}, event)">
            <i class="fas fa-edit"></i>
            تحديث الحالة
          </button>
          <button class="contact-customer-btn" onclick="contactCustomer(${order.id}, event)">
            <i class="fab fa-whatsapp"></i>
            تواصل مع العميل
          </button>
          <button class="view-location-btn" onclick="viewLocation('${encodeURIComponent(address)}', event)">
            <i class="fas fa-map-marker-alt"></i>
            عرض الموقع
          </button>
        </div>
      </div>
    `
  }

  updateDeliveryPersonFilter() {
    const filter = document.getElementById("deliveryPersonFilter")
    if (!filter) return

    const options = ['<option value="all">جميع المندوبين</option>']
    this.deliveryPersonnel.forEach((personnel, name) => {
      options.push(`<option value="${name}">${name} (${personnel.orders.length})</option>`)
    })

    filter.innerHTML = options.join("")
  }

  setupEventListeners() {
    const deliveryPersonFilter = document.getElementById("deliveryPersonFilter")
    if (deliveryPersonFilter) {
      deliveryPersonFilter.addEventListener("change", (e) => {
        this.renderDeliveryOrders(e.target.value)
      })
    }
  }

  async updateOrderStatus(orderId, newStatus) {
    Utils.showLoading(true)
    try {
      await window.api.updateOrder(orderId, { status: newStatus })
      await this.loadDeliveryData()
      Utils.showNotification("تم تحديث حالة الطلب بنجاح", "success")
    } catch (error) {
      console.error("Error updating order status:", error)
      Utils.showNotification("فشل في تحديث حالة الطلب", "error")
    } finally {
      Utils.showLoading(false)
    }
  }
}

// Global functions
function refreshDeliveryData() {
  if (window.deliveryManager) {
    window.deliveryManager.loadDeliveryData()
  }
}

function filterByDeliveryPerson(personName) {
  const filter = document.getElementById("deliveryPersonFilter")
  if (filter) {
    filter.value = personName
    window.deliveryManager.renderDeliveryOrders(personName)
  }
}

function callDeliveryPerson(phone) {
  const formattedPhone = Utils.formatPhoneNumber(phone)
  window.open(`tel:${formattedPhone}`, "_self")
}

async function openDeliveryOrderModal(orderId) {
  Utils.showLoading(true)
  try {
    const order = await window.api.getOrder(orderId)
    const modal = document.getElementById("deliveryOrderModal")
    const modalTitle = document.getElementById("deliveryModalTitle")
    const modalBody = document.getElementById("deliveryModalBody")

    modalTitle.textContent = `تفاصيل الطلب #${order.id}`
    modalBody.innerHTML = generateDeliveryOrderDetailsHTML(order)
    modal.classList.add("active")
  } catch (error) {
    console.error("Error loading delivery order details:", error)
    Utils.showNotification("فشل في تحميل تفاصيل الطلب", "error")
  } finally {
    Utils.showLoading(false)
  }
}

function generateDeliveryOrderDetailsHTML(order) {
  const customerName = `${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim() || "ضيف"
  const deliveryName = Utils.getMetaValue(order.meta_data, "delivery_name") || ""
  const deliveryPhone = Utils.getMetaValue(order.meta_data, "delivery_phone") || ""
  const deliveryDate = Utils.getMetaValue(order.meta_data, "order_date") || "غير محدد"
  const deliveryTime = Utils.getMetaValue(order.meta_data, "order_time") || "غير محدد"
  const zone = Utils.getMetaValue(order.meta_data, "zone") || order.billing.city || "غير محدد"
  const address = order.billing.address_1 || "غير محدد"
  const statusColor = Utils.getStatusColor(order.status)
  const statusLabel = Utils.getStatusLabel(order.status)

  const products = order.line_items
    .map(
      (item) => `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <span>${item.name} × ${item.quantity}</span>
        <span>${Utils.formatCurrency(item.total)}</span>
      </div>
    `,
    )
    .join("")

  // Status update buttons based on current status
  let statusButtons = ""
  if (order.status === "on-delivery") {
    statusButtons = `
      <button class="btn btn-success" onclick="updateDeliveryOrderStatus(${order.id}, 'delivered', event)">
        <i class="fas fa-check"></i> تم التسليم والتحصيل
      </button>
      <button class="btn btn-danger" onclick="updateDeliveryOrderStatus(${order.id}, 'cancelled', event)">
        <i class="fas fa-times"></i> إلغاء الطلب
      </button>
    `
  } else if (order.status === "delivered") {
    statusButtons = `
      <button class="btn btn-primary" onclick="updateDeliveryOrderStatus(${order.id}, 'completed', event)">
        <i class="fas fa-check-double"></i> إكمال الطلب
      </button>
    `
  } else {
    statusButtons = `
      <button class="btn btn-primary" onclick="updateDeliveryOrderStatus(${order.id}, 'on-delivery', event)">
        <i class="fas fa-truck"></i> تعيين للتوصيل
      </button>
    `
  }

  return `
    <div style="display: grid; gap: 1.5rem;">
      <div class="detail-section">
        <h4>معلومات العميل</h4>
        <p><strong>الاسم:</strong> ${customerName}</p>
        <p><strong>التليفون:</strong> ${order.billing.phone || "غير محدد"}</p>
        <p><strong>البريد الإلكتروني:</strong> ${order.billing.email || "غير محدد"}</p>
        <p><strong>المنطقة:</strong> ${zone}</p>
        <p><strong>العنوان:</strong> ${address}</p>
      </div>
      
      <div class="detail-section">
        <h4>معلومات التوصيل</h4>
        <p><strong>المندوب:</strong> ${deliveryName}</p>
        <p><strong>تليفون المندوب:</strong> ${deliveryPhone}</p>
        <p><strong>تاريخ التوصيل:</strong> ${deliveryDate}</p>
        <p><strong>وقت التوصيل:</strong> ${deliveryTime}</p>
        <p><strong>حالة الطلب:</strong> <span style="background-color: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.375rem;">${statusLabel}</span></p>
      </div>
      
      <div class="detail-section">
        <h4>المنتجات</h4>
        ${products}
        <div style="display: flex; justify-content: space-between; padding: 1rem 0; font-weight: 600; border-top: 2px solid var(--border);">
          <span>الإجمالي:</span>
          <span>${Utils.formatCurrency(order.total)}</span>
        </div>
      </div>
      
      <div class="detail-section">
        <h4>تحديث الحالة</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${statusButtons}
        </div>
      </div>
      
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
        <button class="btn btn-success" onclick="contactCustomer(${order.id}, event)">
          <i class="fab fa-whatsapp"></i> تواصل مع العميل
        </button>
        <button class="btn btn-info" onclick="sendAddressToDelivery(${order.id}, event)">
          <i class="fab fa-whatsapp"></i> إرسال العنوان للمندوب
        </button>
        <button class="btn btn-secondary" onclick="viewLocation('${encodeURIComponent(address)}', event)">
          <i class="fas fa-map-marker-alt"></i> عرض الموقع
        </button>
      </div>
    </div>
  `
}

function closeDeliveryOrderModal() {
  document.getElementById("deliveryOrderModal").classList.remove("active")
}

async function updateDeliveryOrderStatus(orderId, newStatus, event) {
  if (event) {
    event.stopPropagation()
  }

  if (confirm(`هل أنت متأكد من تغيير حالة الطلب إلى "${Utils.getStatusLabel(newStatus)}"؟`)) {
    if (window.deliveryManager) {
      await window.deliveryManager.updateOrderStatus(orderId, newStatus)
      closeDeliveryOrderModal()
    }
  }
}

async function contactCustomer(orderId, event) {
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
      Utils.showNotification("لا يوجد رقم تليفون لهذا العميل", "warning")
    }
  } catch (error) {
    console.error("Error contacting customer:", error)
    Utils.showNotification("فشل في التواصل مع العميل", "error")
  }
}

async function sendAddressToDelivery(orderId, event) {
  if (event) {
    event.stopPropagation()
  }

  try {
    const order = await window.api.getOrder(orderId)
    const deliveryPhone = Utils.getMetaValue(order.meta_data, "delivery_phone")

    if (!deliveryPhone) {
      Utils.showNotification("لا يوجد رقم تليفون للمندوب", "warning")
      return
    }

    const message = Utils.generateWhatsAppMessage(order, "address")
    Utils.openWhatsApp(deliveryPhone, message)
  } catch (error) {
    console.error("Error sending address to delivery:", error)
    Utils.showNotification("فشل في إرسال العنوان للمندوب", "error")
  }
}

function viewLocation(address, event) {
  if (event) {
    event.stopPropagation()
  }

  const encodedAddress = encodeURIComponent(address)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
  window.open(googleMapsUrl, "_blank")
}

// Initialize delivery manager
document.addEventListener("DOMContentLoaded", () => {
  window.deliveryManager = new DeliveryManager()
})
