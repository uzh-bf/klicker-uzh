import { useMutation } from '@apollo/client'
import {
  ChangeEmailSettingsDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc, type RouterOutputs } from '../../lib/trpc'
import SimpleSetting from './SimpleSetting'

type UserProfile = NonNullable<RouterOutputs['user']['profile']>

function EmailSetting({ user }: { user: UserProfile }) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const [changeEmailSettings] = useMutation(ChangeEmailSettingsDocument)

  return (
    <SimpleSetting
      label={t('manage.settings.emailUpdates')}
      tooltip={t('manage.settings.emailUpdatesTooltip')}
    >
      <Switch
        checked={user?.sendProjectUpdates ?? false}
        onCheckedChange={async () => {
          await changeEmailSettings({
            variables: { projectUpdates: !user?.sendProjectUpdates },
            optimisticResponse: {
              __typename: 'Mutation',
              changeEmailSettings: {
                __typename: 'User',
                id: user.id,
                sendProjectUpdates: !user?.sendProjectUpdates,
              },
            },
            update: (cache, { data }) => {
              // verify that the change was successful
              if (!data?.changeEmailSettings) return

              // update the cache with the new user data
              cache.updateQuery({ query: UserProfileDocument }, (qData) => {
                if (!qData?.userProfile) return qData

                return {
                  ...qData,
                  userProfile: {
                    ...qData.userProfile,
                    sendProjectUpdates:
                      data.changeEmailSettings!.sendProjectUpdates,
                  },
                }
              })
            },
          })
          await utils.user.profile.invalidate()
        }}
      />
    </SimpleSetting>
  )
}

export default EmailSetting
