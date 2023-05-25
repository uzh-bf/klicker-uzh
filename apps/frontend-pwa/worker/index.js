'use strict'

self.addEventListener('push', function (event) {
  console.log(event)
  const data = event.data.json()
  event.waitUntil(
    registration.showNotification(data.title, {
      body: data.message,
      icon: '/manifest-icon-192.maskable.png',
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        if (clientList.length > 0) {
          let client = clientList[0]
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i]
            }
          }
          return client.focus()
        }
        return clients.openWindow('/')
      })
  )
})

// Activate a new service worker immediately when available in order to update the app to the newest version
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Reload each open page to make sure the new service worker is in charge
self.addEventListener('activate', () => {
  self.clients.matchAll({ type: 'window' })
  .then(tabs => {
    tabs.forEach((tab) => {
      tab.navigate(tab.url)
    })
  })
})
