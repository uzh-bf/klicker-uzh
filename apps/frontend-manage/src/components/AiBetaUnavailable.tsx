import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useManageAiCapability } from './featureFlags/ManageFeatureFlagProvider'

/**
 * Stable landing state for the AI beta routes when the backend capability
 * gate (GrowthBook `ai-beta` and the account's AI entitlement) is closed.
 *
 * Deliberately no redirect: the browser gate starts closed while its inputs
 * load, and bouncing the user on that transient state could loop or drop them
 * somewhere unexpected. The server-side services behind these routes enforce
 * the same two conditions on their own.
 */
function AiBetaUnavailable() {
  const t = useTranslations()
  const { state, retry } = useManageAiCapability()
  const temporarilyUnavailable = state === 'temporarilyUnavailable'

  if (state === 'unresolved') return null

  return (
    <UserNotification
      type="error"
      message={t(
        temporarilyUnavailable
          ? 'manage.ai.temporarilyUnavailableTitle'
          : 'manage.ai.unavailableTitle'
      )}
      data={{ cy: 'ai-beta-unavailable' }}
      className={{ root: 'mx-auto w-max' }}
    >
      <p className="text-sm">
        {t(
          temporarilyUnavailable
            ? 'manage.ai.temporarilyUnavailableDescription'
            : 'manage.ai.unavailableDescription'
        )}
      </p>
      {temporarilyUnavailable ? (
        <Button
          basic
          onClick={() => void retry()}
          data={{ cy: 'ai-beta-retry' }}
          className={{ root: 'mt-2 px-0 underline' }}
        >
          <Button.Label>{t('manage.ai.retry')}</Button.Label>
        </Button>
      ) : null}
    </UserNotification>
  )
}

export default AiBetaUnavailable
