import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

/**
 * Stable landing state for the AI beta routes when the browser gate
 * (GrowthBook `ai-beta` flag and the account's AI entitlement) is closed.
 *
 * Deliberately no redirect: the browser gate starts closed while its inputs
 * load, and bouncing the user on that transient state could loop or drop them
 * somewhere unexpected. The server-side services behind these routes enforce
 * the same two conditions on their own.
 */
function AiBetaUnavailable() {
  const t = useTranslations()

  return (
    <UserNotification
      type="error"
      message={t('manage.ai.unavailableTitle')}
      data={{ cy: 'ai-beta-unavailable' }}
      className={{ root: 'mx-auto w-max' }}
    >
      <p className="text-sm">{t('manage.ai.unavailableDescription')}</p>
    </UserNotification>
  )
}

export default AiBetaUnavailable
