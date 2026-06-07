import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import type { LocaleType, PushDeviceInput } from '@klicker-uzh/graphql/dist/ops'
import {
  PushDevicePlatform,
  PushDeviceProvider,
} from '@klicker-uzh/graphql/dist/ops'

const NATIVE_PUSH_OPT_IN_PREFIX = 'klicker-native-push-opt-in:'
const NATIVE_PUSH_TOKEN_PREFIX = 'klicker-native-push-token:'
const NATIVE_PUSH_INSTALLATION_ID_KEY = 'klicker-native-push-installation-id'

function canUseStorage() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  )
}

export function isNativePushAvailable() {
  return getNativePushPlatform() !== null
}

export function getNativePushPlatform() {
  switch (Capacitor.getPlatform()) {
    case 'ios':
      return PushDevicePlatform.Ios
    case 'android':
      return PushDevicePlatform.Android
    default:
      return null
  }
}

function getParticipantScopedKey(prefix: string, participantId: string) {
  return `${prefix}${participantId}`
}

function getStorageKeys(prefix: string) {
  if (!canUseStorage()) {
    return []
  }

  return Object.keys(window.localStorage).filter((key) =>
    key.startsWith(prefix)
  )
}

function getNativePushInstallationId() {
  if (!canUseStorage()) {
    return undefined
  }

  const storedInstallationId = window.localStorage.getItem(
    NATIVE_PUSH_INSTALLATION_ID_KEY
  )

  if (storedInstallationId) {
    return storedInstallationId
  }

  const installationId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `klicker-${Date.now()}-${Math.random().toString(16).slice(2)}`

  window.localStorage.setItem(NATIVE_PUSH_INSTALLATION_ID_KEY, installationId)

  return installationId
}

export function getNativePushOptIn(participantId?: string) {
  if (!participantId) {
    return false
  }

  return (
    canUseStorage() &&
    window.localStorage.getItem(
      getParticipantScopedKey(NATIVE_PUSH_OPT_IN_PREFIX, participantId)
    ) === 'true'
  )
}

export function setNativePushOptIn(participantId: string, value: boolean) {
  if (!canUseStorage() || !participantId) {
    return
  }

  const storageKey = getParticipantScopedKey(
    NATIVE_PUSH_OPT_IN_PREFIX,
    participantId
  )

  if (value) {
    window.localStorage.setItem(storageKey, 'true')
  } else {
    window.localStorage.removeItem(storageKey)
  }
}

export function getStoredNativePushToken(participantId?: string) {
  if (!canUseStorage() || !participantId) {
    return null
  }

  return window.localStorage.getItem(
    getParticipantScopedKey(NATIVE_PUSH_TOKEN_PREFIX, participantId)
  )
}

function getStoredNativePushTokens(participantId?: string) {
  if (!canUseStorage()) {
    return []
  }

  if (participantId) {
    return [getStoredNativePushToken(participantId)].filter(
      (token): token is string => Boolean(token)
    )
  }

  return getStorageKeys(NATIVE_PUSH_TOKEN_PREFIX)
    .map((key) => window.localStorage.getItem(key))
    .filter((token): token is string => Boolean(token))
}

export function setStoredNativePushToken(participantId: string, token: string) {
  if (!canUseStorage() || !participantId) {
    return
  }

  window.localStorage.setItem(
    getParticipantScopedKey(NATIVE_PUSH_TOKEN_PREFIX, participantId),
    token
  )
}

export function clearNativePushState(participantId?: string) {
  if (!canUseStorage()) {
    return
  }

  if (participantId) {
    window.localStorage.removeItem(
      getParticipantScopedKey(NATIVE_PUSH_OPT_IN_PREFIX, participantId)
    )
    window.localStorage.removeItem(
      getParticipantScopedKey(NATIVE_PUSH_TOKEN_PREFIX, participantId)
    )
    return
  }

  const keysToRemove = [
    ...getStorageKeys(NATIVE_PUSH_OPT_IN_PREFIX),
    ...getStorageKeys(NATIVE_PUSH_TOKEN_PREFIX),
  ]

  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key)
  })
}

export async function unregisterNativePushRegistration() {
  if (!isNativePushAvailable()) {
    return
  }

  await PushNotifications.unregister()
}

export async function revokeStoredNativePushRegistration({
  participantId,
  revokeToken,
}: {
  participantId?: string
  revokeToken?: (token: string) => Promise<unknown>
} = {}) {
  const tokens = getStoredNativePushTokens(participantId)

  try {
    if (revokeToken) {
      await Promise.all(tokens.map((token) => revokeToken(token)))
    }
  } catch (e) {
    console.error('Failed to revoke native push device registration:', e)
  }

  try {
    await unregisterNativePushRegistration()
  } catch (e) {
    console.error('Failed to unregister native push notifications:', e)
  }

  clearNativePushState(participantId)
}

export async function buildNativePushDeviceInput({
  token,
  participantId,
  locale,
}: {
  token: string
  participantId: string
  locale?: LocaleType | null
}): Promise<PushDeviceInput | null> {
  const platform = getNativePushPlatform()

  if (!platform) {
    return null
  }

  const appInfo = await CapacitorApp.getInfo().catch(() => null)
  const version = [appInfo?.version, appInfo?.build].filter(Boolean).join(' ')

  return {
    token,
    platform,
    provider: PushDeviceProvider.Fcm,
    appId: appInfo?.id,
    appVersion: version || undefined,
    deviceId: getNativePushInstallationId(),
    locale,
  }
}
