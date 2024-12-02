import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function PreviewMessage({
  activityType,
  name,
  displayName,
  className,
}: {
  activityType: string
  name: string
  displayName: string
  className?: string
}) {
  const t = useTranslations()
  return (
    <UserNotification type="warning" className={{ root: className }}>
      {t('pwa.general.activityPreview', {
        activity: activityType,
        name,
        displayName,
      })}
    </UserNotification>
  )
}

export default PreviewMessage
