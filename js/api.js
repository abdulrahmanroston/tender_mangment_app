// API service for WooCommerce integration
class APIService {
  constructor() {
    this.credentials = this.getCredentials()
    this.baseURL = this.credentials?.storeUrl + "/wp-json/wc/v3"
    this.headers = {
      Authorization: "Basic " + btoa(`${this.credentials?.consumerKey}:${this.credentials?.consumerSecret}`),
      "Content-Type": "application/json",
    }
  }

  getCredentials() {
    try {
      const stored = localStorage.getItem("tf_credentials")
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error("Error reading credentials:", error)
      return null
    }
  }

  async request(endpoint, options = {}) {
    if (!this.credentials) {
      throw new Error("No credentials found")
    }

    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: this.headers,
      ...options,
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("API request failed:", error)
      throw error
    }
  }

  // Orders API
  async getOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/orders${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  async getOrder(id) {
    return this.request(`/orders/${id}`)
  }

  async updateOrder(id, data) {
    return this.request(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async createOrder(data) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async deleteOrder(id) {
    return this.request(`/orders/${id}`, {
      method: "DELETE",
    })
  }

  // Products API
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/products${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  async getProduct(id) {
    return this.request(`/products/${id}`)
  }

  async updateProduct(id, data) {
    return this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async createProduct(data) {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: "DELETE",
    })
  }

  // Categories API
  async getCategories(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/products/categories${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  // Customers API
  async getCustomers(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/customers${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  async getCustomer(id) {
    return this.request(`/customers/${id}`)
  }

  async createCustomer(data) {
    return this.request("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateCustomer(id, data) {
    return this.request(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  // Coupons API
  async getCoupons(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/coupons${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  // Payment Gateways API
  async getPaymentGateways() {
    return this.request("/payment_gateways")
  }

  // Reports API
  async getSalesReport(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/reports/sales${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  async getTopSellers(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/reports/top_sellers${queryString ? `?${queryString}` : ""}`
    return this.request(endpoint)
  }

  // System Status API
  async getSystemStatus() {
    return this.request("/system_status")
  }

  // Helper methods for common operations
  async searchOrders(searchTerm, params = {}) {
    return this.getOrders({
      search: searchTerm,
      ...params,
    })
  }

  async getOrdersByStatus(status, params = {}) {
    return this.getOrders({
      status: status,
      ...params,
    })
  }

  async getOrdersByDateRange(dateFrom, dateTo, params = {}) {
    return this.getOrders({
      after: dateFrom + "T00:00:00",
      before: dateTo + "T23:59:59",
      ...params,
    })
  }

  async getProductsByCategory(categoryId, params = {}) {
    return this.getProducts({
      category: categoryId,
      ...params,
    })
  }

  async getProductsLowStock(threshold = 10, params = {}) {
    return this.getProducts({
      stock_status: "instock",
      ...params,
    }).then((products) => {
      return products.filter((product) => {
        const stock = Number.parseInt(product.stock_quantity) || 0
        return stock <= threshold && stock > 0
      })
    })
  }

  async updateProductStock(productId, warehouse, quantity) {
    const metaData = [
      {
        key: `_stock_${warehouse}`,
        value: quantity.toString(),
      },
    ]

    return this.updateProduct(productId, { meta_data: metaData })
  }

  async transferStock(productId, fromWarehouse, toWarehouse, quantity) {
    const product = await this.getProduct(productId)
    const fromStock = Number.parseInt(this.getMetaValue(product.meta_data, `_stock_${fromWarehouse}`)) || 0
    const toStock = Number.parseInt(this.getMetaValue(product.meta_data, `_stock_${toWarehouse}`)) || 0

    if (fromStock < quantity) {
      throw new Error(`Insufficient stock in ${fromWarehouse}. Available: ${fromStock}`)
    }

    const metaData = [
      {
        key: `_stock_${fromWarehouse}`,
        value: (fromStock - quantity).toString(),
      },
      {
        key: `_stock_${toWarehouse}`,
        value: (toStock + quantity).toString(),
      },
    ]

    return this.updateProduct(productId, { meta_data: metaData })
  }

  getMetaValue(metaData, key) {
    const meta = metaData.find((item) => item.key === key)
    return meta ? meta.value : null
  }
}

// Create global API instance
window.api = new APIService()
