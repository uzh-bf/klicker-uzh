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

async function determineInitialSubscriptionState() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return {
      disabled: true,
      info: 'Push notifications are not supported by your browser.',
      reg: null,
      sub: null,
    }
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (Notification.permission === 'denied') {
    return {
      disabled: true,
      info: 'You have disabled push notifications for this app. If you want to subscribe, enable push notifications in your browser.',
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

async function subscribeParticipant(
  registration: ServiceWorkerRegistration,
  courseId: string
) {
  const applicationServerKey = base64ToUint8Array(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!
  )
  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey,
  })
  // TODO: updateSubscriptionOnServer(subscription, courseId)
  console.log('User is subscribed.')
  return newSubscription
}

export {
  base64ToUint8Array,
  determineInitialSubscriptionState,
  subscribeParticipant,
}
