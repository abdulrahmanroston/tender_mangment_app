// Authentication functionality
class AuthManager {
  constructor() {
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadSavedCredentials()
  }

  setupEventListeners() {
    const loginForm = document.getElementById("loginForm")
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e))
    }
  }

  loadSavedCredentials() {
    const savedCredentials = localStorage.getItem("tf_credentials")
    if (savedCredentials) {
      try {
        const credentials = JSON.parse(savedCredentials)
        document.getElementById("consumerKey").value = credentials.consumerKey || ""
        document.getElementById("consumerSecret").value = credentials.consumerSecret || ""
        document.getElementById("storeUrl").value = credentials.storeUrl || ""
      } catch (error) {
        console.error("Error loading saved credentials:", error)
      }
    }
  }

  async handleLogin(event) {
    event.preventDefault()

    const consumerKey = document.getElementById("consumerKey").value.trim()
    const consumerSecret = document.getElementById("consumerSecret").value.trim()
    const storeUrl = document.getElementById("storeUrl").value.trim()
    const appName = document.getElementById("appName").value.trim() || "Flex Solutions"

    if (!consumerKey || !consumerSecret || !storeUrl) {
      this.showError("Please fill in all required fields")
      return
    }

    this.showLoading(true)

    try {
      // Test API connection
      const testUrl = `${storeUrl}/wp-json/wc/v3/orders?per_page=1`
      const response = await fetch(testUrl, {
        headers: {
          Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`),
        },
      })

      if (!response.ok) {
        throw new Error("Invalid credentials or store URL")
      }

      // Save credentials and settings
      const credentials = {
        consumerKey,
        consumerSecret,
        storeUrl,
        loginTime: new Date().toISOString(),
      }

      const settings = {
        appName,
        companyName: appName,
        ordersPerPage: 25,
        templates: {
          invoice: `*Hello {customerName}*\n\nWe're happy to inform you that your order is ready and will be delivered on {deliveryDate} at {deliveryTime}.\n\n*Order Summary:*\n{products}\n\n*Subtotal:* {subtotal} EGP\n*Delivery Fee:* {deliveryFee} EGP\n*Total:* {total} EGP\n\nYou can explore all our delicious frozen meals anytime at:\n{storeUrl}\n\n*Thank you for choosing {companyName}!*`,
          address: `*Order #{orderId}*\n\n*Customer:* {customerName}\n*Phone:* {phone}\n*Address:* {address}\n*Zone:* {zone}\n*Delivery Date:* {deliveryDate}\n*Delivery Time:* {deliveryTime}\n*Total:* {total} EGP`,
          orderData: `*Order #{orderId}*\n\n*Customer:* {customerName}\n*Phone:* {phone}\n*Zone:* {zone}\n*Address:* {address}\n*Delivery Date:* {deliveryDate}\n*Delivery Time:* {deliveryTime}\n\n*Products:*\n{products}\n\n*Total:* {total} EGP`,
        },
      }

      localStorage.setItem("tf_credentials", JSON.stringify(credentials))
      localStorage.setItem("tf_settings", JSON.stringify(settings))

      // Update manifest for PWA
      this.updateManifest(appName)

      // Redirect to dashboard
      window.location.href = "dashboard.html"
    } catch (error) {
      console.error("Login error:", error)
      this.showError("Login failed: " + error.message)
    } finally {
      this.showLoading(false)
    }
  }

  updateManifest(appName) {
    // Update the manifest dynamically for PWA
    const manifestData = {
      name: appName,
      short_name: appName,
      description: "Management System by Abdulrahman Roston",
      start_url: "/dashboard.html",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1a73e8",
      icons: [
        {
          src: "icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    }

    // Store manifest data for later use
    localStorage.setItem("tf_manifest", JSON.stringify(manifestData))
  }

  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay")
    if (overlay) {
      overlay.classList.toggle("active", show)
    }
  }

  showError(message) {
    // Create and show error notification
    const notification = document.createElement("div")
    notification.className = "error-notification"
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `
    notification.textContent = message
    document.body.appendChild(notification)

    setTimeout(() => {
      notification.remove()
    }, 5000)
  }
}

// Logout function
function logout() {
  localStorage.removeItem("tf_credentials")
  localStorage.removeItem("tf_settings")
  localStorage.removeItem("tf_manifest")
  window.location.href = "index.html"
}

// Initialize auth manager
document.addEventListener("DOMContentLoaded", () => {
  new AuthManager()
})
