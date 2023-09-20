import { Capacitor } from '@capacitor/core'
import { PushNotifications, Token } from '@capacitor/push-notifications'

/**
 * This method determines whether a user's client (e.g., chrome, firefox, etc.) has an actual
 * subscription to the browser's push service on the component's initial render.
 */
async function determineInitialSubscriptionState() {
  if (Capacitor.isNativePlatform()) {
    let permissionStatus = await PushNotifications.checkPermissions()

    if (permissionStatus.receive !== 'granted') {
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          registerNativeClient()
        } else {
          console.error('Permission for registration denied: ', result)
          return {
            disabled: true,
            info: 'Keine Berechtigung für Push-Benachrichtigungen erhalten',
            reg: null,
            sub: null,
            token: null,
          }
        }
      })
    } else {
      registerNativeClient()
    }
  } else {
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
        token: null,
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
        token: null,
      }
    }
    return {
      disabled: false,
      info: '',
      reg: registration,
      sub: subscription,
      token: null,
    }
  }
}

const registerNativeClient = () => {
  PushNotifications.register()

  // On success, we should be able to receive notifications
  PushNotifications.addListener('registration', (token: Token) => {
    return {
      disabled: false,
      info: '',
      reg: null,
      sub: null,
      token: token.value,
    }
  })

  // Some issue with our setup and push will not work
  PushNotifications.addListener('registrationError', (error: any) => {
    console.log('Error on registration: ' + JSON.stringify(error))
    return {
      disabled: false,
      info: `${JSON.stringify(error)}`,
      reg: null,
      sub: null,
      token: null,
    }
  })
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
