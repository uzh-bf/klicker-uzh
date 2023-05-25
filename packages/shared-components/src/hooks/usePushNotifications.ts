import { useEffect, useState } from 'react'
import {
  determineInitialSubscriptionState,
  subscribeParticipantToPushService,
} from '../utils/push'

interface PushNotificationsOptions {
  subscribeToPush: (
    subscriptionObject: PushSubscription,
    courseId: string
  ) => void
  unsubscribeFromPush: (
    subscriptionObject: PushSubscription,
    courseId: string
  ) => void
}

const usePushNotifications = ({
  subscribeToPush,
  unsubscribeFromPush,
}: PushNotificationsOptions) => {
  const [pushDisabled, setPushDisabled] = useState<boolean | null>(null)
  const [userInfo, setUserInfo] = useState<string>('')
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  )

  // This is necessary to make sure navigator is defined
  useEffect(() => {
    determineInitialSubscriptionState()
      .then(({ disabled, info, reg, sub }) => {
        setPushDisabled(disabled)
        setUserInfo(info)
        setRegistration(reg)
        setSubscription(sub)
      })
      .catch((e) => {
        console.error(
          'An error occured while determining the initial subscription state: ',
          e
        )
      })
  }, [])

  /**
   * If a user has a valid push subscription for its browser to the push service,
   * the only thing left to do is to store the subscription details on the backend,
   * so that it can be used to send push notifications from there.
   *
   * If a user has no subscription for its client (e.g., browser) yet, then a new
   * subscription to the browser's push service needs to be created and consequently
   * stored on the backend.
   */
  async function subscribeUserToPush(courseId: string) {
    // There is a valid subscription to the push service
    if (subscription) {
      subscribeToPush(subscription, courseId)
    } else {
      // There is no valid subscription to the push service
      try {
        const newSubscription = await subscribeParticipantToPushService(
          registration
        )
        setSubscription(newSubscription)

        // Store new subscription object on the server
        subscribeToPush(newSubscription, courseId)
      } catch (e) {
        console.error(
          'An error occured while subscribing a user to push notifications: ',
          e
        )
        // Push notifications are disabled
        if (Notification.permission === 'denied') {
          setPushDisabled(true)
          setUserInfo(
            `Sie haben Push-Benachrichtigungen für diese Applikation deaktiviert. Wenn Sie Push-Benachrichtigungen
            abonnieren möchten, aktivieren Sie diese in Ihrem Browser und laden Sie die Seite neu.`
          )
          // User has clicked away the prompt without allowing nor blocking
        } else if (e instanceof DOMException && e.name === 'NotAllowedError') {
          setUserInfo(
            'Bitte erlauben Sie Push-Benachrichtigungen für diese Applikation in Ihrem Browser.'
          )
          // An error occured
        } else {
          console.log('error occured: ', e)
          setUserInfo(
            'Beim Versuch, Sie für Push-Benachrichtigungen zu registrieren, ist ein Fehler aufgetreten. Bitte versuchen Sie es später noch einmal.'
          )
        }
      }
    }
  }

  /**
   * When unsubscribing a user from push notifications, the subscription needs to be
   * removed from the browser's push service as well as from the backend.
   */
  async function unsubscribeUserFromPush(courseId: string) {
    if (subscription) {
      // remove subscription from browser's push service
      await subscription.unsubscribe()
      setSubscription(null)

      // remove subscription from backend
      unsubscribeFromPush(subscription, courseId)
    }
  }

  return {
    pushDisabled,
    userInfo,
    setUserInfo,
    subscription,
    subscribeUserToPush,
    unsubscribeUserFromPush,
  }
}

export default usePushNotifications
