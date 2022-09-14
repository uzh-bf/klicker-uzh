;(() => {
  'use strict'
  self.addEventListener('push', function (t) {
    const n = JSON.parse(t.data.text())
    t.waitUntil(
      registration.showNotification(n.title, {
        body: n.message,
        icon: '/manifest-icon-192.maskable.png',
      })
    )
  }),
    self.addEventListener('notificationclick', function (t) {
      t.notification.close(),
        t.waitUntil(
          clients
            .matchAll({ type: 'window', includeUncontrolled: !0 })
            .then(function (t) {
              if (t.length > 0) {
                let n = t[0]
                for (let e = 0; e < t.length; e++) t[e].focused && (n = t[e])
                return n.focus()
              }
              return clients.openWindow('/')
            })
        )
    })
})()
