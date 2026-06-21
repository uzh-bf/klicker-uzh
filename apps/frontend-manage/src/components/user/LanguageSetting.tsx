import { routing } from '@klicker-uzh/i18n'
import { Select, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import SimpleSetting from '../../components/user/SimpleSetting'
import { trpc, type RouterInputs, type RouterOutputs } from '../../lib/trpc'

type UserProfile = NonNullable<RouterOutputs['user']['profile']>
type UserLocale = RouterInputs['user']['changeUserLocale']['locale']

interface LanguageSettingProps {
  user: UserProfile
}

function LanguageSetting({ user }: LanguageSettingProps) {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, query, asPath } = router
  const utils = trpc.useUtils()
  const changeUserLocale = trpc.user.changeUserLocale.useMutation()

  return (
    <SimpleSetting
      label={t('manage.settings.languageSettings')}
      tooltip={t('manage.settings.languageTooltip')}
    >
      <Select
        disabled={changeUserLocale.isLoading}
        value={user?.locale || 'en'}
        onChange={async (newLocale: string) => {
          if (newLocale === user.locale) return

          try {
            await changeUserLocale.mutateAsync({
              locale: newLocale as UserLocale,
            })
            void utils.user.profile.invalidate().catch(console.error)
            await router.push({ pathname, query }, asPath, {
              locale: newLocale,
            })
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
          }
        }}
        items={routing.locales.map((loc) => ({
          label: t(`shared.generic.${loc}`),
          value: loc,
          data: { cy: `language-${loc}` },
        }))}
        className={{
          content: 'font-normal text-black',
          trigger: 'h-8 w-max font-normal text-black',
          item: 'h-8',
        }}
        data={{ cy: 'language-select' }}
      />
    </SimpleSetting>
  )
}

export default LanguageSetting
