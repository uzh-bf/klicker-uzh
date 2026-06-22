import { Switch, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc, type RouterOutputs } from '../../lib/trpc'
import SimpleSetting from './SimpleSetting'

type UserProfile = NonNullable<RouterOutputs['user']['profile']>

function EmailSetting({ user }: { user: UserProfile }) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const changeEmailSettings = trpc.user.changeEmailSettings.useMutation({
    onSuccess: async () => {
      await utils.user.profile.invalidate().catch(console.error)
    },
  })

  return (
    <SimpleSetting
      label={t('manage.settings.emailUpdates')}
      tooltip={t('manage.settings.emailUpdatesTooltip')}
    >
      <Switch
        disabled={changeEmailSettings.isLoading}
        checked={user?.sendProjectUpdates ?? false}
        onCheckedChange={async (projectUpdates) => {
          try {
            await changeEmailSettings.mutateAsync({ projectUpdates })
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
          }
        }}
      />
    </SimpleSetting>
  )
}

export default EmailSetting
