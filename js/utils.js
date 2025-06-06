// Utility functions and helpers
class Utils {
  static formatCurrency(amount, currency = "EGP") {
    return `${currency} ${Number.parseFloat(amount || 0).toFixed(2)}`
  }

  static formatDate(dateString) {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  static formatDateTime(dateString) {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  static getStatusColor(status) {
    const colors = {
      pending: "#f59e0b",
      processing: "#3b82f6",
      "on-hold": "#f97316",
      "on-delivery": "#8b5cf6",
      delivered: "#10b981",
      completed: "#10b981",
      cancelled: "#ef4444",
      refunded: "#6b7280",
      failed: "#991b1b",
    }
    return colors[status] || "#6b7280"
  }

  static getStatusLabel(status) {
    const labels = {
      pending: "Pending",
      processing: "Processing",
      "on-hold": "On Hold",
      "on-delivery": "On Delivery",
      delivered: "Delivered",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
      failed: "Failed",
    }
    return labels[status] || status
  }

  static getMetaValue(metaData, key) {
    if (!metaData || !Array.isArray(metaData)) return ""
    const meta = metaData.find((m) => m.key === key)
    return meta && meta.value !== undefined ? meta.value : ""
  }

  static formatPhoneNumber(phone) {
    if (!phone) return ""
    const cleaned = phone
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^0-9+]/g, "")

    if (cleaned.startsWith("+20")) return cleaned
    if (cleaned.startsWith("0") && cleaned.length === 11) {
      return "+20" + cleaned.substring(1)
    }
    if (cleaned.length === 10) return "+20" + cleaned

    return cleaned
  }

  static debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  static showNotification(message, type = "info", duration = 3000) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll(".notification")
    existingNotifications.forEach((notification) => notification.remove())

    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease;
        `

    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    }

    notification.style.backgroundColor = colors[type] || colors.info
    notification.textContent = message

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease"
      setTimeout(() => notification.remove(), 300)
    }, duration)
  }

  static showLoading(show = true) {
    const overlay = document.getElementById("loadingOverlay")
    if (overlay) {
      if (show) {
        overlay.classList.add("active")
      } else {
        overlay.classList.remove("active")
      }
    }
  }

  static generateWhatsAppMessage(order, type = "invoice") {
    const settings = this.getSettings()
    const templates = settings.templates || {}

    const billing = order.billing || {}
    const customerName = `${billing.first_name || ""} ${billing.last_name || ""}`.trim() || "Customer"
    const orderId = order.id
    const total = this.formatCurrency(order.total)
    const deliveryDate = this.getMetaValue(order.meta_data, "order_date") || "Not specified"
    const deliveryTime = this.getMetaValue(order.meta_data, "order_time") || "Not specified"
    const zone = this.getMetaValue(order.meta_data, "zone") || billing.city || "Not specified"
    const address = billing.address_1 || "Not specified"
    const phone = billing.phone || "Not specified"

    // Format products list
    const products =
      order.line_items
        ?.map((item) => {
          const arabicName = this.getMetaValue(item.meta_data, "arabic_name") || item.name
          return `• ${arabicName} x${item.quantity} - ${this.formatCurrency(item.subtotal)}`
        })
        .join("\n") || "No products"

    // Calculate subtotal and fees
    const subtotal = this.formatCurrency(order.total - (order.total_tax || 0))
    const deliveryFee = order.fee_lines?.find((fee) => fee.name === "Delivery Fee")?.total || "0"

    // Replace template variables
    let message = ""

    if (type === "invoice" && templates.invoice) {
      message = templates.invoice
        .replace(/{customerName}/g, customerName)
        .replace(/{orderId}/g, orderId)
        .replace(/{products}/g, products)
        .replace(/{total}/g, total)
        .replace(/{subtotal}/g, subtotal)
        .replace(/{deliveryFee}/g, this.formatCurrency(deliveryFee))
        .replace(/{deliveryDate}/g, deliveryDate)
        .replace(/{deliveryTime}/g, deliveryTime)
        .replace(/{zone}/g, zone)
        .replace(/{address}/g, address)
        .replace(/{phone}/g, phone)
        .replace(/{companyName}/g, settings.companyName || "Flex Solutions")
        .replace(/{storeUrl}/g, this.getCredentials()?.storeUrl || "")
    } else if (type === "address" && templates.address) {
      message = templates.address
        .replace(/{customerName}/g, customerName)
        .replace(/{orderId}/g, orderId)
        .replace(/{zone}/g, zone)
        .replace(/{address}/g, address)
        .replace(/{phone}/g, phone)
        .replace(/{deliveryDate}/g, deliveryDate)
        .replace(/{deliveryTime}/g, deliveryTime)
        .replace(/{total}/g, total)
    } else if (type === "orderData" && templates.orderData) {
      message = templates.orderData
        .replace(/{customerName}/g, customerName)
        .replace(/{orderId}/g, orderId)
        .replace(/{products}/g, products)
        .replace(/{zone}/g, zone)
        .replace(/{address}/g, address)
        .replace(/{phone}/g, phone)
        .replace(/{deliveryDate}/g, deliveryDate)
        .replace(/{deliveryTime}/g, deliveryTime)
        .replace(/{total}/g, total)
    } else {
      // Default message if no template is available
      message =
        `*Hello ${customerName}*\n\n` +
        `Your order #${orderId} is ready for delivery!\n\n` +
        `*Order Details:*\n${products}\n\n` +
        `*Total:* ${total}\n\n` +
        `*Delivery Date:* ${deliveryDate}\n` +
        `*Delivery Time:* ${deliveryTime}\n` +
        `*Zone:* ${zone}\n` +
        `*Address:* ${address}\n\n` +
        `Thank you for choosing ${settings.companyName || "Flex Solutions"}!`
    }

    return message
  }

  static openWhatsApp(phone, message) {
    const formattedPhone = this.formatPhoneNumber(phone)
    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`
    window.open(url, "_blank")
  }

  static exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      this.showNotification("No data to export", "warning")
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || ""
            return `"${value.toString().replace(/"/g, '""')}"`
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  static setupSidebar() {
    const menuToggle = document.getElementById("menuToggle")
    const sidebar = document.getElementById("sidebar")

    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        sidebar.classList.toggle("active")
      })

      // Close sidebar when clicking outside on mobile
      document.addEventListener("click", (e) => {
        if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove("active")
        }
      })
    }
  }

  static checkAuth() {
    const credentials = localStorage.getItem("tf_credentials")
    if (!credentials) {
      window.location.href = "index.html"
      return null
    }
    return JSON.parse(credentials)
  }

  static getCredentials() {
    try {
      const credentials = localStorage.getItem("tf_credentials")
      return credentials ? JSON.parse(credentials) : null
    } catch (error) {
      console.error("Error reading credentials:", error)
      return null
    }
  }

  static getSettings() {
    try {
      const settings = localStorage.getItem("tf_settings")
      return settings ? JSON.parse(settings) : {}
    } catch (error) {
      console.error("Error reading settings:", error)
      return {}
    }
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem("tf_settings", JSON.stringify(settings))
      return true
    } catch (error) {
      console.error("Error saving settings:", error)
      return false
    }
  }

  static updateAppName() {
    const settings = this.getSettings()
    const appNameElements = document.querySelectorAll("#appNameDisplay")
    if (appNameElements.length > 0) {
      appNameElements.forEach((el) => {
        el.textContent = settings.appName || "Flex Solutions"
      })
    }
  }
}

// Add CSS for notifications and animations
const style = document.createElement("style")
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .loading-overlay.active {
        display: flex !important;
    }
`
document.head.appendChild(style)

// Initialize common functionality
document.addEventListener("DOMContentLoaded", () => {
  Utils.setupSidebar()
  Utils.updateAppName()

  // Check authentication for protected pages
  if (
    !window.location.pathname.includes("index.html") &&
    window.location.pathname !== "/" &&
    !window.location.pathname.includes("index")
  ) {
    Utils.checkAuth()
  }

  // Add click event listeners to all buttons to improve responsiveness
  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", function (e) {
      // Add visual feedback
      this.style.opacity = "0.8"
      setTimeout(() => {
        this.style.opacity = "1"
      }, 100)
    })
  })
})
