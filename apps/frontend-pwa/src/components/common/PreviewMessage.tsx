import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function PreviewMessage({
  activityType,
  name,
  displayName,
}: {
  activityType: string
  name: string
  displayName: string
}) {
  const t = useTranslations()
  return (
    <UserNotification type="warning">
      {t('pwa.general.activityPreview', {
        activity: activityType,
        name,
        displayName,
      })}
    </UserNotification>
  )
}

export default PreviewMessage
