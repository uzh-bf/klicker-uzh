import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function MediaLibrary() {
  const t = useTranslations()

  return (
    <div className="min-h-full w-full shrink-0">
      <H2>{t('manage.resources.mediaLibrary')}</H2>
      <UserNotification
        type="info"
        message={t('manage.resources.mediaLibraryAvailableSoon')}
      />
    </div>
  )
}

export default MediaLibrary
