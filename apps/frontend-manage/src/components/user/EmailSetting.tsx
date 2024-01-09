import { useMutation } from '@apollo/client'
import {
  ChangeEmailSettingsDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import SimpleSetting from './SimpleSetting'

interface EmailSettingProps {
  user: User
}

function EmailSetting({ user }: EmailSettingProps) {
  const t = useTranslations()
  const [changeEmailSettings] = useMutation(ChangeEmailSettingsDocument)

  return (
    <SimpleSetting
      label={t('manage.settings.emailUpdates')}
      tooltip={t('manage.settings.emailUpdatesTooltip')}
    >
      <Switch
        checked={user?.sendProjectUpdates ?? false}
        onCheckedChange={async () =>
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
          })
        }
      />
    </SimpleSetting>
  )
}

export default EmailSetting
