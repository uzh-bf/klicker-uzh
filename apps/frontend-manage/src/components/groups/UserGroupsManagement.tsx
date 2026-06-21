import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'
import UserGroupCreation from './UserGroupCreation'
import UserGroupEntry from './UserGroupEntry'

function UserGroupsManagement() {
  const t = useTranslations()
  const { data, error, isLoading } = trpc.sharing.userGroups.useQuery()
  const userGroups = data?.userGroups
  const userGroupsError = Boolean(error)
  const userGroupsUnavailable = userGroupsError && !userGroups

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
            <H3>{t('manage.userGroups.existingUserGroups')}</H3>
            {isLoading ? (
              <Loader />
            ) : (
              <>
                {userGroupsUnavailable ? (
                  <UserNotification
                    type="error"
                    message={t('shared.generic.systemError')}
                  />
                ) : (
                  <>
                    {userGroupsError ? (
                      <UserNotification
                        type="error"
                        message={t('shared.generic.systemError')}
                        className={{ root: 'mb-2' }}
                      />
                    ) : null}
                    {userGroups == null || userGroups.length === 0 ? (
                      <UserNotification
                        message={t('manage.userGroups.noGroups')}
                      />
                    ) : (
                      <div className="mt-1.5 flex flex-col gap-2">
                        {userGroups.map((group) => (
                          <UserGroupEntry
                            key={`group-item-${group.id}`}
                            group={group}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserGroupsManagement
