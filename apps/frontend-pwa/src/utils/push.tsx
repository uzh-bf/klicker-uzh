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
      info: 'Push-Benachrichtigungen werden von Ihrem Browser nicht unterstützt. Dies ist z. B. der Fall, wenn Sie ein iPhone benutzen.',
      reg: null,
      sub: null,
    }
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (Notification.permission === 'denied') {
    return {
      disabled: true,
      info: 'Sie haben Push-Benachrichtigungen für diese Applikation deaktiviert. Wenn Sie Push-Benachrichtigungen abonnieren möchten, aktivieren Sie diese in Ihrem Browser und laden Sie die Seite neu.',
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

// TODO: Adapt once backend is specified
function sendSubscriptionToBackEnd(subscription: PushSubscription) {
  return fetch('/api/save-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.')
      }

      return response.json()
    })
    .then(function (responseData) {
      if (!(responseData.data && responseData.data.success)) {
        throw new Error('Bad response from server.')
      }
    })
}

// TODO: function updateSubscriptionServer()

export {
  base64ToUint8Array,
  determineInitialSubscriptionState,
  subscribeParticipant,
}
