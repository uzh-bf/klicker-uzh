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
