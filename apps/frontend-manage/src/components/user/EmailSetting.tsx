import { Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc, type RouterOutputs } from '../../lib/trpc'
import SimpleSetting from './SimpleSetting'

type UserProfile = NonNullable<RouterOutputs['user']['profile']>

function EmailSetting({ user }: { user: UserProfile }) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const changeEmailSettings = trpc.user.changeEmailSettings.useMutation()

  return (
    <SimpleSetting
      label={t('manage.settings.emailUpdates')}
      tooltip={t('manage.settings.emailUpdatesTooltip')}
    >
      <Switch
        checked={user?.sendProjectUpdates ?? false}
        onCheckedChange={async () => {
          await changeEmailSettings.mutateAsync({
            projectUpdates: !user?.sendProjectUpdates,
          })
          await utils.user.profile.invalidate()
        }}
      />
    </SimpleSetting>
  )
}

export default EmailSetting
