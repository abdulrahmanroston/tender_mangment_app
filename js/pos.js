// POS functionality
class POSManager {
  constructor() {
    this.cart = []
    this.products = []
    this.categories = []
    this.selectedWarehouse = ""
    this.customer = null
    this.init()
  }

  async init() {
    this.setupEventListeners()
    await this.loadProducts()
    await this.loadCategories()
    this.updateCartDisplay()
  }

  setupEventListeners() {
    // Warehouse selector
    const warehouseSelect = document.getElementById("warehouseSelect")
    if (warehouseSelect) {
      warehouseSelect.addEventListener("change", (e) => {
        this.selectedWarehouse = e.target.value
        this.loadProducts()
      })
    }

    // Product search
    const productSearch = document.getElementById("productSearch")
    if (productSearch) {
      productSearch.addEventListener(
        "input",
        window.Utils.debounce((e) => {
          this.filterProducts(e.target.value)
        }, 300),
      )
    }

    // Category tabs
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("category-tab")) {
        const categoryId = e.target.dataset.category
        this.filterByCategory(categoryId)

        // Update active tab
        document.querySelectorAll(".category-tab").forEach((tab) => tab.classList.remove("active"))
        e.target.classList.add("active")
      }
    })

    // Clear cart button
    const clearCartBtn = document.getElementById("clearCartBtn")
    if (clearCartBtn) {
      clearCartBtn.addEventListener("click", () => {
        if (confirm("هل أنت متأكد من مسح السلة؟")) {
          this.clearCart()
        }
      })
    }
  }

  async loadProducts() {
    window.Utils.showLoading(true)
    try {
      const params = {
        per_page: 100,
        status: "publish",
      }

      this.products = await window.api.getProducts(params)
      this.renderProducts()
    } catch (error) {
      console.error("Error loading products:", error)
      window.Utils.showNotification("فشل في تحميل المنتجات", "error")
    } finally {
      window.Utils.showLoading(false)
    }
  }

  async loadCategories() {
    try {
      this.categories = await window.api.getCategories({ per_page: 50 })
      this.renderCategoryTabs()
    } catch (error) {
      console.error("Error loading categories:", error)
    }
  }

  renderCategoryTabs() {
    const categoryTabs = document.getElementById("categoryTabs")
    if (!categoryTabs) return

    const tabs = [
      '<button class="category-tab active" data-category="all">الكل</button>',
      ...this.categories.map(
        (category) => `<button class="category-tab" data-category="${category.id}">${category.name}</button>`,
      ),
    ]

    categoryTabs.innerHTML = tabs.join("")
  }

  renderProducts(productsToRender = null) {
    const productsGrid = document.getElementById("posProductsGrid")
    if (!productsGrid) return

    const products = productsToRender || this.products

    if (products.length === 0) {
      productsGrid.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1 / -1;">
          <i class="fas fa-box" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <p>لا توجد منتجات متاحة</p>
        </div>
      `
      return
    }

    productsGrid.innerHTML = products.map((product) => this.createProductCard(product)).join("")
  }

  createProductCard(product) {
    const stock = this.getProductStock(product)
    const isOutOfStock = stock <= 0
    const price = Number.parseFloat(product.price || 0)

    return `
      <div class="pos-product-card ${isOutOfStock ? "disabled" : ""}" 
           onclick="${isOutOfStock ? "" : `window.posManager.addToCart(${product.id})`}">
        <img src="${product.images[0]?.src || "/placeholder.svg?height=80&width=80"}" 
             alt="${product.name}" class="pos-product-image">
        <div class="pos-product-name">${product.name}</div>
        <div class="pos-product-price">${window.Utils.formatCurrency(price)}</div>
        <div class="pos-product-stock">
          ${isOutOfStock ? "نفد المخزون" : `متوفر: ${stock}`}
        </div>
      </div>
    `
  }

  getProductStock(product) {
    if (!this.selectedWarehouse) return Number.parseInt(product.stock_quantity) || 0

    const warehouseStock = window.Utils.getMetaValue(product.meta_data, `_stock_${this.selectedWarehouse}`)
    return Number.parseInt(warehouseStock) || 0
  }

  filterProducts(searchTerm) {
    if (!searchTerm.trim()) {
      this.renderProducts()
      return
    }

    const filtered = this.products.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    this.renderProducts(filtered)
  }

  filterByCategory(categoryId) {
    if (categoryId === "all") {
      this.renderProducts()
      return
    }

    const filtered = this.products.filter((product) =>
      product.categories.some((cat) => cat.id.toString() === categoryId),
    )
    this.renderProducts(filtered)
  }

  addToCart(productId) {
    const product = this.products.find((p) => p.id === productId)
    if (!product) return

    const stock = this.getProductStock(product)
    if (stock <= 0) {
      window.Utils.showNotification("هذا المنتج غير متوفر في المخزون", "warning")
      return
    }

    const existingItem = this.cart.find((item) => item.id === productId)
    if (existingItem) {
      if (existingItem.quantity >= stock) {
        window.Utils.showNotification("لا يمكن إضافة كمية أكثر من المتوفر", "warning")
        return
      }
      existingItem.quantity++
    } else {
      this.cart.push({
        id: productId,
        name: product.name,
        price: Number.parseFloat(product.price || 0),
        quantity: 1,
        image: product.images[0]?.src || "",
      })
    }

    this.updateCartDisplay()
    window.Utils.showNotification(`تم إضافة ${product.name} إلى السلة`, "success")
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter((item) => item.id !== productId)
    this.updateCartDisplay()
  }

  updateCartQuantity(productId, newQuantity) {
    const item = this.cart.find((item) => item.id === productId)
    if (!item) return

    const product = this.products.find((p) => p.id === productId)
    const stock = this.getProductStock(product)

    if (newQuantity <= 0) {
      this.removeFromCart(productId)
      return
    }

    if (newQuantity > stock) {
      window.Utils.showNotification("الكمية المطلوبة أكبر من المتوفر", "warning")
      return
    }

    item.quantity = newQuantity
    this.updateCartDisplay()
  }

  updateCartDisplay() {
    const cartItems = document.getElementById("cartItems")
    const cartCount = document.getElementById("cartCount")
    const cartSubtotal = document.getElementById("cartSubtotal")
    const cartTotal = document.getElementById("cartTotal")

    if (!cartItems || !cartCount || !cartSubtotal || !cartTotal) return

    if (this.cart.length === 0) {
      cartItems.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>السلة فارغة</p>
        </div>
      `
      cartCount.textContent = "0 منتج"
      cartSubtotal.textContent = window.Utils.formatCurrency(0)
      cartTotal.textContent = window.Utils.formatCurrency(0)
      return
    }

    cartItems.innerHTML = this.cart
      .map(
        (item) => `
        <div class="cart-item">
          <img src="${item.image || "/placeholder.svg?height=50&width=50"}" alt="${item.name}" class="cart-item-image">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${window.Utils.formatCurrency(item.price)}</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="window.posManager.updateCartQuantity(${
              item.id
            }, ${item.quantity - 1})">-</button>
            <input type="number" class="qty-input" value="${item.quantity}" 
              onchange="window.posManager.updateCartQuantity(${item.id}, parseInt(this.value))" min="1">
            <button class="qty-btn" onclick="window.posManager.updateCartQuantity(${
              item.id
            }, ${item.quantity + 1})">+</button>
            <button class="remove-item-btn" onclick="window.posManager.removeFromCart(${item.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `,
      )
      .join("")

    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    cartCount.textContent = `${totalItems} منتج`
    cartSubtotal.textContent = window.Utils.formatCurrency(subtotal)
    cartTotal.textContent = window.Utils.formatCurrency(subtotal)
  }

  clearCart() {
    this.cart = []
    this.updateCartDisplay()
    window.Utils.showNotification("تم مسح السلة", "info")
  }

  openCustomerModal() {
    const modal = document.getElementById("customerModal")
    if (modal) {
      modal.classList.add("active")
    }
  }

  closeCustomerModal() {
    const modal = document.getElementById("customerModal")
    if (modal) {
      modal.classList.remove("active")
    }
  }

  saveCustomerInfo() {
    // Implementation for saving customer info
    this.closeCustomerModal()
  }

  proceedToCheckout() {
    if (this.cart.length === 0) {
      window.Utils.showNotification("السلة فارغة", "warning")
      return
    }

    // Implementation for checkout
    window.Utils.showNotification("تم إنشاء الطلب بنجاح", "success")
  }
}

// Global functions
function openCustomerModal() {
  if (window.posManager) {
    window.posManager.openCustomerModal()
  }
}

function closeCustomerModal() {
  if (window.posManager) {
    window.posManager.closeCustomerModal()
  }
}

function saveCustomerInfo() {
  if (window.posManager) {
    window.posManager.saveCustomerInfo()
  }
}

function proceedToCheckout() {
  if (window.posManager) {
    window.posManager.proceedToCheckout()
  }
}

function clearCart() {
  if (window.posManager) {
    window.posManager.clearCart()
  }
}

// Initialize POS manager
document.addEventListener("DOMContentLoaded", () => {
  window.posManager = new POSManager()
})
