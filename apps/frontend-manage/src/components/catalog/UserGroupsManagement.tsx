import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function UserGroupsManagement() {
  const t = useTranslations()

  return (
    <div>
      <H2>{t('manage.catalog.userGroups')}</H2>
      <UserNotification
        type="info"
        message={t('manage.catalog.userGroupsComingSoon')}
      />
    </div>
  )
}

export default UserGroupsManagement
