import { faBell, faBellSlash } from '@fortawesome/free-solid-svg-icons'
import type { LocaleType } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useNativePushNotifications } from '../../lib/hooks/useNativePushNotifications'

interface NativePushSettingsProps {
  participantId?: string
  locale?: LocaleType | null
}

function NativePushSettings({
  participantId,
  locale,
}: NativePushSettingsProps) {
  const t = useTranslations()
  const { nativePushAvailable, status, enabled, busy, enable, disable } =
    useNativePushNotifications({ participantId, locale })

  if (!nativePushAvailable || !participantId) {
    return null
  }

  const isDenied = status === 'denied'
  const isError = status === 'error'

  return (
    <UserNotification
      type={isDenied || isError ? 'warning' : 'info'}
      data={{ cy: 'native-push-settings' }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <div className="font-bold">{t('pwa.push.nativeTitle')}</div>
          <div>
            {isError
              ? t('pwa.push.nativeError')
              : isDenied
                ? t('pwa.push.nativeDenied')
                : enabled
                  ? t('pwa.push.nativeEnabled')
                  : t('pwa.push.nativeDisabled')}
          </div>
        </div>
        <Button
          className={{ root: 'h-8 whitespace-nowrap' }}
          disabled={busy}
          onClick={() => {
            if (enabled) {
              void disable()
            } else {
              void enable()
            }
          }}
          data={{ cy: enabled ? 'disable-native-push' : 'enable-native-push' }}
        >
          <Button.Icon icon={enabled ? faBellSlash : faBell} loading={busy} />
          <Button.Label>
            {enabled ? t('pwa.push.disableNative') : t('pwa.push.enableNative')}
          </Button.Label>
        </Button>
      </div>
    </UserNotification>
  )
}

export default NativePushSettings
