import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import UserGroupCreation from './UserGroupCreation'
import UserGroupList from './UserGroupList'

function UserGroupsManagement() {
  const t = useTranslations()

  return (
    <div>
      <div className="h-full w-full">
        <H2>{t('manage.general.userGroups')}</H2>
        <div className="mb-2">{t('manage.userGroups.description')}</div>
        <div className="mt-6 flex flex-col lg:flex-row-reverse">
          <div className="lg:w-1/2 lg:border-l lg:pl-4">
            <UserGroupCreation />
          </div>
          <div className="lg:w-1/2 lg:pr-4">
            <UserGroupList />
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserGroupsManagement
