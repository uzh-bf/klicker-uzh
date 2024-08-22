/**
 * This method determines whether a user's client (e.g., chrome, firefox, etc.) has an actual
 * subscription to the browser's push service on the component's initial render.
 */
async function determineInitialSubscriptionState() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return {
      disabled: true,
      info: 'Push-Notifications are not supported by your browser.',
      reg: null,
      sub: null,
    }
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (Notification.permission === 'denied') {
    return {
      disabled: true,
      info: 'You have disabled push notifications for this application. If you want to subscribe to push notifications, please enable them in your browser and reload the page.',
      reg: registration,
      sub: subscription,
    }
  }
  return {
    disabled: false,
    info: '',
    reg: registration,
    sub: subscription,
  }
}

/**
 * The Web Push Protocol requires application server keys (a.k.a. VAPID keys) to be in a binary format.
 * Newly generated VAPID keys are usually in a base64 format. This method therefore converts a
 * base64 string to a Uint8Array to ensure compatiblity with the Web Push Protocol.
 */
function base64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(b64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function subscribeParticipantToPushService(
  registration: ServiceWorkerRegistration
) {
  const applicationServerKey = base64ToUint8Array(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!
  )
  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey,
  })

  return newSubscription
}

export { determineInitialSubscriptionState, subscribeParticipantToPushService }
