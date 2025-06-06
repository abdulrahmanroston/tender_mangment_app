// Settings management functionality
class SettingsManager {
  constructor() {
    this.settings = {}
    this.deliveryPersonnel = []
    this.currentPersonnelId = null
    this.init()
  }

  async init() {
    this.loadSettings()
    this.setupEventListeners()
    this.populateSettingsForm()
    this.loadDeliveryPersonnel()
  }

  loadSettings() {
    try {
      const storedSettings = localStorage.getItem("tf_settings")
      this.settings = storedSettings ? JSON.parse(storedSettings) : this.getDefaultSettings()
    } catch (error) {
      console.error("Error loading settings:", error)
      this.settings = this.getDefaultSettings()
    }
  }

  getDefaultSettings() {
    return {
      appName: "Flex Solutions",
      companyName: "Flex Solutions",
      ordersPerPage: 25,
      templates: {
        invoice: `*Hello {customerName}*\n\nWe're happy to inform you that your order is ready and will be delivered on {deliveryDate} at {deliveryTime}.\n\n*Order Summary:*\n{products}\n\n*Subtotal:* {subtotal} EGP\n*Delivery Fee:* {deliveryFee} EGP\n*Total:* {total} EGP\n\nYou can explore all our delicious frozen meals anytime at:\n{storeUrl}\n\n*Thank you for choosing {companyName}!*`,
        address: `*Order #{orderId}*\n\n*Customer:* {customerName}\n*Phone:* {phone}\n*Address:* {address}\n*Zone:* {zone}\n*Delivery Date:* {deliveryDate}\n*Delivery Time:* {deliveryTime}\n*Total:* {total} EGP`,
        orderData: `*Order #{orderId}*\n\n*Customer:* {customerName}\n*Phone:* {phone}\n*Zone:* {zone}\n*Address:* {address}\n*Delivery Date:* {deliveryDate}\n*Delivery Time:* {deliveryTime}\n\n*Products:*\n{products}\n\n*Total:* {total} EGP`,
      },
      deliveryPersonnel: [],
    }
  }

  setupEventListeners() {
    // Save all settings button
    const saveAllBtn = document.querySelector(".save-settings-btn")
    if (saveAllBtn) {
      saveAllBtn.addEventListener("click", () => this.saveAllSettings())
    }

    // Export settings button
    const exportBtn = document.querySelector('button[onclick="exportSettings()"]')
    if (exportBtn) {
      exportBtn.onclick = (e) => {
        e.preventDefault()
        this.exportSettings()
      }
    }

    // Import settings button
    const importBtn = document.querySelector('button[onclick="importSettings()"]')
    if (importBtn) {
      importBtn.onclick = (e) => {
        e.preventDefault()
        document.getElementById("importFile").click()
      }
    }

    // Reset settings button
    const resetBtn = document.querySelector('button[onclick="resetSettings()"]')
    if (resetBtn) {
      resetBtn.onclick = (e) => {
        e.preventDefault()
        this.resetSettings()
      }
    }

    // Import file change handler
    const importFile = document.getElementById("importFile")
    if (importFile) {
      importFile.addEventListener("change", (e) => this.handleImportFile(e))
    }

    // Add delivery person button
    const addPersonBtn = document.querySelector('button[onclick="addDeliveryPerson()"]')
    if (addPersonBtn) {
      addPersonBtn.onclick = (e) => {
        e.preventDefault()
        this.openPersonnelModal()
      }
    }
  }

  populateSettingsForm() {
    // App settings
    document.getElementById("appName").value = this.settings.appName || ""
    document.getElementById("companyName").value = this.settings.companyName || ""
    document.getElementById("ordersPerPage").value = this.settings.ordersPerPage || 25

    // WhatsApp templates
    document.getElementById("invoiceTemplate").value = this.settings.templates?.invoice || ""
    document.getElementById("addressTemplate").value = this.settings.templates?.address || ""
    document.getElementById("orderDataTemplate").value = this.settings.templates?.orderData || ""

    // API settings
    const credentials = Utils.getCredentials()
    if (credentials) {
      document.getElementById("storeUrl").value = credentials.storeUrl || ""
      document.getElementById("consumerKey").value = credentials.consumerKey || ""
    }
  }

  loadDeliveryPersonnel() {
    this.deliveryPersonnel = this.settings.deliveryPersonnel || []
    this.renderDeliveryPersonnel()
  }

  renderDeliveryPersonnel() {
    const personnelList = document.getElementById("personnelList")
    if (!personnelList) return

    if (this.deliveryPersonnel.length === 0) {
      personnelList.innerHTML = `
                <div class="empty-list">
                    <p>No delivery personnel added yet.</p>
                </div>
            `
      return
    }

    personnelList.innerHTML = this.deliveryPersonnel
      .map(
        (person, index) => `
                <div class="personnel-item">
                    <div class="personnel-info">
                        <h4>${person.name}</h4>
                        <p>${person.phone || "No phone"}</p>
                        <span class="zone-badge">${person.zone || "No zone"}</span>
                    </div>
                    <div class="personnel-actions">
                        <button class="edit-btn" onclick="window.settingsManager.editDeliveryPerson(${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="window.settingsManager.deleteDeliveryPerson(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `,
      )
      .join("")
  }

  saveAllSettings() {
    Utils.showLoading(true)
    try {
      // App settings
      this.settings.appName = document.getElementById("appName").value || "Flex Solutions"
      this.settings.companyName = document.getElementById("companyName").value || "Flex Solutions"
      this.settings.ordersPerPage = Number.parseInt(document.getElementById("ordersPerPage").value) || 25

      // WhatsApp templates
      this.settings.templates = {
        invoice: document.getElementById("invoiceTemplate").value,
        address: document.getElementById("addressTemplate").value,
        orderData: document.getElementById("orderDataTemplate").value,
      }

      // Save settings to localStorage
      localStorage.setItem("tf_settings", JSON.stringify(this.settings))

      // Update app name in manifest
      this.updateManifest(this.settings.appName)

      Utils.showNotification("Settings saved successfully", "success")
    } catch (error) {
      console.error("Error saving settings:", error)
      Utils.showNotification("Failed to save settings", "error")
    } finally {
      Utils.showLoading(false)
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

    // Update app name display
    Utils.updateAppName()
  }

  exportSettings() {
    const settingsData = JSON.stringify(this.settings, null, 2)
    const blob = new Blob([settingsData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `flex_solutions_settings_${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    Utils.showNotification("Settings exported successfully", "success")
  }

  handleImportFile(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target.result)
        this.settings = { ...this.settings, ...importedSettings }
        localStorage.setItem("tf_settings", JSON.stringify(this.settings))
        this.populateSettingsForm()
        this.loadDeliveryPersonnel()
        Utils.showNotification("Settings imported successfully", "success")
      } catch (error) {
        console.error("Error importing settings:", error)
        Utils.showNotification("Failed to import settings. Invalid file format.", "error")
      }
    }
    reader.readAsText(file)
    event.target.value = "" // Reset file input
  }

  resetSettings() {
    if (confirm("Are you sure you want to reset all settings to default? This cannot be undone.")) {
      this.settings = this.getDefaultSettings()
      localStorage.setItem("tf_settings", JSON.stringify(this.settings))
      this.populateSettingsForm()
      this.loadDeliveryPersonnel()
      Utils.showNotification("Settings reset to default", "success")
    }
  }

  openPersonnelModal(id = null) {
    this.currentPersonnelId = id
    const modal = document.getElementById("personnelModal")
    const modalTitle = document.getElementById("personnelModalTitle")
    const nameInput = document.getElementById("personName")
    const phoneInput = document.getElementById("personPhone")
    const zoneInput = document.getElementById("personZone")

    if (id !== null) {
      // Edit existing personnel
      const person = this.deliveryPersonnel[id]
      modalTitle.textContent = "Edit Delivery Person"
      nameInput.value = person.name || ""
      phoneInput.value = person.phone || ""
      zoneInput.value = person.zone || ""
    } else {
      // Add new personnel
      modalTitle.textContent = "Add Delivery Person"
      nameInput.value = ""
      phoneInput.value = ""
      zoneInput.value = ""
    }

    modal.classList.add("active")
  }

  closePersonnelModal() {
    document.getElementById("personnelModal").classList.remove("active")
    this.currentPersonnelId = null
  }

  saveDeliveryPerson() {
    const nameInput = document.getElementById("personName")
    const phoneInput = document.getElementById("personPhone")
    const zoneInput = document.getElementById("personZone")

    const name = nameInput.value.trim()
    if (!name) {
      Utils.showNotification("Name is required", "error")
      return
    }

    const personData = {
      name: name,
      phone: phoneInput.value.trim(),
      zone: zoneInput.value.trim(),
    }

    if (this.currentPersonnelId !== null) {
      // Update existing
      this.deliveryPersonnel[this.currentPersonnelId] = personData
    } else {
      // Add new
      this.deliveryPersonnel.push(personData)
    }

    this.settings.deliveryPersonnel = this.deliveryPersonnel
    localStorage.setItem("tf_settings", JSON.stringify(this.settings))
    this.renderDeliveryPersonnel()
    this.closePersonnelModal()

    Utils.showNotification(
      this.currentPersonnelId !== null ? "Delivery person updated" : "Delivery person added",
      "success",
    )
  }

  editDeliveryPerson(index) {
    this.openPersonnelModal(index)
  }

  deleteDeliveryPerson(index) {
    if (confirm("Are you sure you want to delete this delivery person?")) {
      this.deliveryPersonnel.splice(index, 1)
      this.settings.deliveryPersonnel = this.deliveryPersonnel
      localStorage.setItem("tf_settings", JSON.stringify(this.settings))
      this.renderDeliveryPersonnel()
      Utils.showNotification("Delivery person deleted", "success")
    }
  }
}

// Global functions
function addDeliveryPerson() {
  if (window.settingsManager) {
    window.settingsManager.openPersonnelModal()
  }
}

function closePersonnelModal() {
  if (window.settingsManager) {
    window.settingsManager.closePersonnelModal()
  }
}

function saveDeliveryPerson() {
  if (window.settingsManager) {
    window.settingsManager.saveDeliveryPerson()
  }
}

function exportSettings() {
  if (window.settingsManager) {
    window.settingsManager.exportSettings()
  }
}

function importSettings() {
  document.getElementById("importFile").click()
}

function resetSettings() {
  if (window.settingsManager) {
    window.settingsManager.resetSettings()
  }
}

function saveAllSettings() {
  if (window.settingsManager) {
    window.settingsManager.saveAllSettings()
  }
}

function handleImportFile(event) {
  if (window.settingsManager) {
    window.settingsManager.handleImportFile(event)
  }
}

// Initialize settings manager
document.addEventListener("DOMContentLoaded", () => {
  window.settingsManager = new SettingsManager()
})
