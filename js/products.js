// Products management functionality
class ProductsManager {
  constructor() {
    this.products = []
    this.filteredProducts = []
    this.currentProduct = null
    this.filters = {
      search: "",
      stockStatus: [],
      warehouse: "all",
    }
    this.init()
  }

  async init() {
    this.setupEventListeners()
    await this.loadProducts()
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

    // Product search
    const productSearch = document.getElementById("productSearch")
    if (productSearch) {
      productSearch.addEventListener(
        "input",
        Utils.debounce((e) => {
          this.filters.search = e.target.value
          this.applyFilters()
        }, 300),
      )
    }

    // Stock status checkboxes
    document.querySelectorAll('input[type="checkbox"][value]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateStockFilters()
      })
    })

    // Warehouse filter
    const warehouseFilter = document.getElementById("warehouseFilter")
    if (warehouseFilter) {
      warehouseFilter.addEventListener("change", (e) => {
        this.filters.warehouse = e.target.value
        this.applyFilters()
      })
    }

    // Tab switching in product modal
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-btn")) {
        const tabName = e.target.dataset.tab
        this.switchTab(tabName)
      }
    })
  }

  updateStockFilters() {
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"][value]:checked')
    this.filters.stockStatus = Array.from(checkedBoxes).map((cb) => cb.value)
  }

  async loadProducts() {
    Utils.showLoading(true)
    try {
      const params = {
        per_page: 100,
        status: "publish",
      }

      this.products = await window.api.getProducts(params)
      this.filteredProducts = [...this.products]
      this.renderProducts()
    } catch (error) {
      console.error("Error loading products:", error)
      Utils.showNotification("Failed to load products", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  applyFilters() {
    this.filteredProducts = this.products.filter((product) => {
      // Search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase()
        const productName = product.name.toLowerCase()
        const arabicName = Utils.getMetaValue(product.meta_data, "arabic_name")?.toLowerCase() || ""
        const categories = product.categories.map((cat) => cat.name.toLowerCase()).join(" ")

        if (!productName.includes(searchTerm) && !arabicName.includes(searchTerm) && !categories.includes(searchTerm)) {
          return false
        }
      }

      // Stock status filter
      if (this.filters.stockStatus.length > 0) {
        const stockStatus = product.stock_status
        const stockQuantity = Number.parseInt(product.stock_quantity) || 0
        const isInStock = stockStatus === "instock" && stockQuantity > 0
        const isOutOfStock = stockStatus === "outofstock" || stockQuantity <= 0
        const isLowStock = isInStock && stockQuantity <= 10

        if (
          (this.filters.stockStatus.includes("instock") && !isInStock) ||
          (this.filters.stockStatus.includes("outofstock") && !isOutOfStock) ||
          (this.filters.stockStatus.includes("lowstock") && !isLowStock)
        ) {
          return false
        }
      }

      // Warehouse filter
      if (this.filters.warehouse !== "all") {
        const warehouseStock = Utils.getMetaValue(product.meta_data, `_stock_${this.filters.warehouse}`)
        if (!warehouseStock || Number.parseInt(warehouseStock) <= 0) {
          return false
        }
      }

      return true
    })

    this.renderProducts()
  }

  renderProducts() {
    const productsGrid = document.getElementById("productsGrid")
    if (!productsGrid) return

    if (this.filteredProducts.length === 0) {
      productsGrid.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1 / -1;">
                    <i class="fas fa-box" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No products found matching your criteria</p>
                </div>
            `
      return
    }

    productsGrid.innerHTML = this.filteredProducts.map((product) => this.createProductCard(product)).join("")
  }

  createProductCard(product) {
    const stockQuantity = Number.parseInt(product.stock_quantity) || 0
    const isOutOfStock = product.stock_status === "outofstock" || stockQuantity <= 0
    const isLowStock = product.stock_status === "instock" && stockQuantity <= 10
    const stockClass = isOutOfStock ? "stock-out" : isLowStock ? "stock-low" : "stock-in"
    const stockLabel = isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"
    const arabicName = Utils.getMetaValue(product.meta_data, "arabic_name") || ""

    // Get warehouse-specific stock
    const orabyStock = Number.parseInt(Utils.getMetaValue(product.meta_data, "_stock_oraby")) || 0
    const lavistaStock = Number.parseInt(Utils.getMetaValue(product.meta_data, "_stock_lavista")) || 0
    const manufacturingStock = Number.parseInt(Utils.getMetaValue(product.meta_data, "_stock_manufacturing")) || 0
    const gizaStock = Number.parseInt(Utils.getMetaValue(product.meta_data, "_stock_giza")) || 0

    // Calculate total stock across all warehouses
    const totalWarehouseStock = orabyStock + lavistaStock + manufacturingStock + gizaStock

    return `
            <div class="product-card ${isOutOfStock ? "out-of-stock" : ""}">
                <img src="${product.images[0]?.src || "/placeholder.svg?height=150&width=150"}" 
                     alt="${product.name}" class="product-image">
                
                ${isLowStock ? '<span class="low-stock-badge">Low Stock</span>' : ""}
                
                <div class="product-name">${product.name}</div>
                ${arabicName ? `<div class="product-arabic-name">${arabicName}</div>` : ""}
                
                <div class="product-price">${Utils.formatCurrency(product.price)}</div>
                
                <div class="product-stock">
                    <span class="stock-status ${stockClass}">${stockLabel}</span>
                    <span>Stock: ${stockQuantity}</span>
                </div>
                
                <div class="warehouse-stock">
                    ${orabyStock > 0 ? `<span class="warehouse-badge">Oraby: ${orabyStock}</span>` : ""}
                    ${lavistaStock > 0 ? `<span class="warehouse-badge">Lavista: ${lavistaStock}</span>` : ""}
                    ${
                      manufacturingStock > 0
                        ? `<span class="warehouse-badge">Manufacturing: ${manufacturingStock}</span>`
                        : ""
                    }
                    ${gizaStock > 0 ? `<span class="warehouse-badge">Giza: ${gizaStock}</span>` : ""}
                </div>
                
                <div class="product-actions">
                    <button class="edit-product-btn" onclick="openProductModal(${product.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `
  }

  async openProductModal(productId) {
    Utils.showLoading(true)
    try {
      const product = await window.api.getProduct(productId)
      this.currentProduct = product

      const modal = document.getElementById("productModal")
      const modalTitle = document.getElementById("productModalTitle")

      modalTitle.textContent = `Edit Product: ${product.name}`

      // Populate general info
      document.getElementById("productName").value = product.name || ""
      document.getElementById("arabicName").value = Utils.getMetaValue(product.meta_data, "arabic_name") || ""
      document.getElementById("regularPrice").value = product.regular_price || ""
      document.getElementById("stockStatus").value = product.stock_status || "instock"

      // Populate warehouse-specific info
      this.populateWarehouseTab("oraby", product)
      this.populateWarehouseTab("lavista", product)
      this.populateWarehouseTab("manufacturing", product)
      this.populateWarehouseTab("giza", product)

      // Show the modal
      modal.classList.add("active")

      // Activate the first tab
      this.switchTab("general")
    } catch (error) {
      console.error("Error loading product details:", error)
      Utils.showNotification("Failed to load product details", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  populateWarehouseTab(warehouse, product) {
    const stock = Number.parseInt(Utils.getMetaValue(product.meta_data, `_stock_${warehouse}`)) || 0
    const price = Utils.getMetaValue(product.meta_data, `_price_${warehouse}`) || ""
    const minStock = Utils.getMetaValue(product.meta_data, `_min_stock_${warehouse}`) || ""

    document.getElementById(`${warehouse}CurrentStock`).textContent = stock
    document.getElementById(`${warehouse}StockInput`).value = stock

    if (document.getElementById(`${warehouse}Price`)) {
      document.getElementById(`${warehouse}Price`).value = price
    }

    if (document.getElementById(`${warehouse}MinStock`)) {
      document.getElementById(`${warehouse}MinStock`).value = minStock
    }
  }

  switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.remove("active")
    })

    // Deactivate all tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active")
    })

    // Activate the selected tab
    document.getElementById(`${tabName}-tab`).classList.add("active")
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add("active")
  }

  closeProductModal() {
    document.getElementById("productModal").classList.remove("active")
    this.currentProduct = null
  }

  adjustStock(warehouse, amount) {
    const stockInput = document.getElementById(`${warehouse}StockInput`)
    const currentStock = Number.parseInt(stockInput.value) || 0
    const newStock = Math.max(0, currentStock + amount)
    stockInput.value = newStock
    document.getElementById(`${warehouse}CurrentStock`).textContent = newStock
  }

  async updateProduct() {
    if (!this.currentProduct) return

    Utils.showLoading(true)
    try {
      const productId = this.currentProduct.id
      const productData = {
        name: document.getElementById("productName").value,
        regular_price: document.getElementById("regularPrice").value,
        stock_status: document.getElementById("stockStatus").value,
        meta_data: [
          {
            key: "arabic_name",
            value: document.getElementById("arabicName").value,
          },
        ],
      }

      // Add warehouse-specific data
      const warehouses = ["oraby", "lavista", "manufacturing", "giza"]
      warehouses.forEach((warehouse) => {
        const stock = document.getElementById(`${warehouse}StockInput`).value
        productData.meta_data.push({
          key: `_stock_${warehouse}`,
          value: stock,
        })

        if (document.getElementById(`${warehouse}Price`)) {
          const price = document.getElementById(`${warehouse}Price`).value
          productData.meta_data.push({
            key: `_price_${warehouse}`,
            value: price,
          })
        }

        if (document.getElementById(`${warehouse}MinStock`)) {
          const minStock = document.getElementById(`${warehouse}MinStock`).value
          productData.meta_data.push({
            key: `_min_stock_${warehouse}`,
            value: minStock,
          })
        }
      })

      // Calculate total stock across all warehouses
      const totalStock = warehouses.reduce((sum, warehouse) => {
        return sum + Number.parseInt(document.getElementById(`${warehouse}StockInput`).value || 0)
      }, 0)

      // Update main stock quantity
      productData.stock_quantity = totalStock

      await window.api.updateProduct(productId, productData)
      await this.loadProducts()
      this.closeProductModal()
      Utils.showNotification("Product updated successfully", "success")
    } catch (error) {
      console.error("Error updating product:", error)
      Utils.showNotification("Failed to update product", "error")
    } finally {
      Utils.showLoading(false)
    }
  }

  applyProductFilters() {
    this.applyFilters()
    document.getElementById("filtersPanel").classList.remove("active")
  }

  clearProductFilters() {
    // Reset all filter inputs
    document.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false))
    document.getElementById("productSearch").value = ""
    document.getElementById("warehouseFilter").value = "all"

    // Reset filters object
    this.filters = {
      search: "",
      stockStatus: [],
      warehouse: "all",
    }

    this.applyFilters()
    document.getElementById("filtersPanel").classList.remove("active")
  }
}

// Global functions
function refreshProducts() {
  if (window.productsManager) {
    window.productsManager.loadProducts()
  }
}

function openProductModal(productId) {
  if (window.productsManager) {
    window.productsManager.openProductModal(productId)
  }
}

function closeProductModal() {
  if (window.productsManager) {
    window.productsManager.closeProductModal()
  }
}

function adjustStock(warehouse, amount) {
  if (window.productsManager) {
    window.productsManager.adjustStock(warehouse, amount)
  }
}

function updateProduct() {
  if (window.productsManager) {
    window.productsManager.updateProduct()
  }
}

function applyProductFilters() {
  if (window.productsManager) {
    window.productsManager.applyProductFilters()
  }
}

function clearProductFilters() {
  if (window.productsManager) {
    window.productsManager.clearProductFilters()
  }
}

// Initialize products manager
document.addEventListener("DOMContentLoaded", () => {
  window.productsManager = new ProductsManager()
})
