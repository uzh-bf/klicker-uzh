// @ts-nocheck
'use strict'

// Activate a new service worker immediately when available in order to update the app to the newest version
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Reload each open page to make sure the new service worker is in charge
self.addEventListener('activate', () => {
  self.clients.matchAll({ type: 'window' }).then((tabs) => {
    tabs.forEach((tab) => {
      tab.navigate(tab.url)
    })
  })
})
