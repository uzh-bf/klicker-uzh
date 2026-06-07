import { useMutation } from '@apollo/client'
import type { Token } from '@capacitor/push-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import type { LocaleType } from '@klicker-uzh/graphql/dist/ops'
import {
  RegisterPushDeviceDocument,
  RevokePushDeviceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect, useState } from 'react'
import {
  buildNativePushDeviceInput,
  getNativePushOptIn,
  getStoredNativePushToken,
  isNativePushAvailable,
  revokeStoredNativePushRegistration,
  setNativePushOptIn,
  setStoredNativePushToken,
} from '../nativePush'

type NativePushStatus =
  | 'unavailable'
  | 'checking'
  | 'notEnabled'
  | 'requesting'
  | 'registering'
  | 'enabled'
  | 'denied'
  | 'error'

interface UseNativePushNotificationsOptions {
  participantId?: string
  locale?: LocaleType | null
}

interface NativeListenerHandle {
  remove: () => Promise<void>
}

function statusFromPermission(receive: string, participantId?: string) {
  if (receive === 'granted' && getNativePushOptIn(participantId)) {
    return 'enabled'
  }

  if (receive === 'denied') {
    return 'denied'
  }

  return 'notEnabled'
}

export function useNativePushNotifications({
  participantId,
  locale,
}: UseNativePushNotificationsOptions) {
  const [nativePushAvailable, setNativePushAvailable] = useState(false)
  const [status, setStatus] = useState<NativePushStatus>('unavailable')

  const [registerPushDevice] = useMutation(RegisterPushDeviceDocument)
  const [revokePushDevice] = useMutation(RevokePushDeviceDocument)

  useEffect(() => {
    const available = isNativePushAvailable()

    setNativePushAvailable(available)
    setStatus(available ? 'checking' : 'unavailable')
  }, [])

  const registerToken = useCallback(
    async (token: Token) => {
      if (!participantId) {
        return
      }

      const device = await buildNativePushDeviceInput({
        token: token.value,
        participantId,
        locale,
      })

      if (!device) {
        return
      }

      await registerPushDevice({ variables: { device } })
      setStoredNativePushToken(participantId, token.value)
      setNativePushOptIn(participantId, true)
      setStatus('enabled')
    },
    [locale, participantId, registerPushDevice]
  )

  const disable = useCallback(async () => {
    if (!nativePushAvailable) {
      return
    }

    await revokeStoredNativePushRegistration({
      participantId,
      revokeToken: async (token) => {
        await revokePushDevice({ variables: { token } })
      },
    })
    setStatus('notEnabled')
  }, [nativePushAvailable, participantId, revokePushDevice])

  const enable = useCallback(async () => {
    if (!nativePushAvailable || !participantId) {
      return
    }

    setStatus('requesting')

    try {
      const permission = await PushNotifications.requestPermissions()

      if (permission.receive !== 'granted') {
        await disable()
        setStatus(permission.receive === 'denied' ? 'denied' : 'notEnabled')
        return
      }

      setNativePushOptIn(participantId, true)
      setStatus('registering')
      await PushNotifications.register()
    } catch (e) {
      setStatus('error')
      console.error('Failed to enable native push notifications:', e)
    }
  }, [disable, nativePushAvailable, participantId])

  useEffect(() => {
    if (!nativePushAvailable) {
      setStatus('unavailable')
      return
    }

    if (!participantId) {
      setStatus('notEnabled')
      return
    }

    let removed = false
    const listenerHandles: NativeListenerHandle[] = []

    async function setupNativePush() {
      const handles: NativeListenerHandle[] = []

      try {
        const registrationHandle = await PushNotifications.addListener(
          'registration',
          (token) => {
            void registerToken(token).catch((e) => {
              setStatus('error')
              console.error('Failed to register native push token:', e)
            })
          }
        )
        handles.push(registrationHandle)

        const registrationErrorHandle = await PushNotifications.addListener(
          'registrationError',
          (event) => {
            setStatus('error')
            console.error('Native push registration failed:', event)
          }
        )
        handles.push(registrationErrorHandle)
      } catch (e) {
        await Promise.all(handles.map((handle) => handle.remove()))
        throw e
      }

      if (removed) {
        await Promise.all(handles.map((handle) => handle.remove()))
        return
      }

      listenerHandles.push(...handles)

      const permission = await PushNotifications.checkPermissions()

      if (removed) {
        return
      }

      setStatus(statusFromPermission(permission.receive, participantId))

      if (
        permission.receive === 'granted' &&
        getNativePushOptIn(participantId)
      ) {
        setStatus('registering')
        await PushNotifications.register()
      } else if (
        permission.receive === 'denied' &&
        getStoredNativePushToken(participantId)
      ) {
        await disable()
        setStatus('denied')
      }
    }

    void setupNativePush().catch((e) => {
      setStatus('error')
      console.error('Failed to setup native push listeners:', e)
    })

    return () => {
      removed = true
      listenerHandles.forEach((handle) => {
        void handle.remove()
      })
    }
  }, [disable, nativePushAvailable, participantId, registerToken])

  return {
    nativePushAvailable,
    status,
    enabled: status === 'enabled' || status === 'registering',
    busy:
      status === 'checking' ||
      status === 'requesting' ||
      status === 'registering',
    enable,
    disable,
  }
}
