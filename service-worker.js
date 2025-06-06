// Service Worker for PWA functionality
const CACHE_NAME = "flex-solutions-v1"
const urlsToCache = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/orders.html",
  "/products.html",
  "/pos.html",
  "/delivery.html",
  "/analytics.html",
  "/settings.html",
  "/styles/main.css",
  "/styles/dashboard.css",
  "/styles/orders.css",
  "/styles/products.css",
  "/styles/pos.css",
  "/styles/delivery.css",
  "/styles/analytics.css",
  "/styles/settings.css",
  "/js/utils.js",
  "/js/api.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/orders.js",
  "/js/products.js",
  "/js/pos.js",
  "/js/delivery.js",
  "/js/analytics.js",
  "/js/settings.js",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache")
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error("Failed to cache resources:", error)
      }),
  )
})

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      if (response) {
        return response
      }

      // Clone the request because it's a stream
      const fetchRequest = event.request.clone()

      return fetch(fetchRequest)
        .then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response because it's a stream
          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
        .catch((error) => {
          console.error("Fetch failed:", error)
          // Return offline page or cached fallback
          if (event.request.destination === "document") {
            return caches.match("/index.html")
          }
        })
    }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
})

// Background sync for offline orders
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(syncPendingOrders())
  }
})

// Push notification handler
self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "New notification from Flex Solutions",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "View Details",
        icon: "/icons/checkmark.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/icons/xmark.png",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification("Flex Solutions", options))
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "explore") {
    // Open the app
    event.waitUntil(clients.openWindow("/dashboard.html"))
  }
})

// Helper function to sync pending orders
async function syncPendingOrders() {
  try {
    // Get pending orders from IndexedDB
    const pendingOrders = await getPendingOrdersFromDB()

    for (const order of pendingOrders) {
      try {
        // Try to sync the order
        await syncOrder(order)
        // Remove from pending if successful
        await removePendingOrder(order.id)
      } catch (error) {
        console.error("Failed to sync order:", order.id, error)
      }
    }
  } catch (error) {
    console.error("Error syncing pending orders:", error)
  }
}

// Helper function to get pending orders from IndexedDB
async function getPendingOrdersFromDB() {
  // This is a placeholder. In a real app, you would implement IndexedDB operations
  return []
}

// Helper function to sync an order
async function syncOrder(order) {
  // This is a placeholder. In a real app, you would implement API calls
  return Promise.resolve()
}

// Helper function to remove a pending order
async function removePendingOrder(orderId) {
  // This is a placeholder. In a real app, you would implement IndexedDB operations
  return Promise.resolve()
}
