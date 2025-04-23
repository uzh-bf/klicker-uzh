import { useQuery } from '@apollo/client'
import { GetUserGroupsUserDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import UserGroupCreation from './UserGroupCreation'
import UserGroupEntry from './UserGroupEntry'

function UserGroupsManagement() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetUserGroupsUserDocument)

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
            {loading ? (
              <Loader />
            ) : (
              data?.getUserGroupsUser?.map((group) => (
                <UserGroupEntry key={`group-item-${group.id}`} group={group} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserGroupsManagement
