import { useMutation } from '@apollo/client'
import {
  ChangeUserLocaleDocument,
  LocaleType,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import SimpleSetting from '../../components/user/SimpleSetting'

interface LanguageSettingProps {
  user: User
}

function LanguageSetting({ user }: LanguageSettingProps) {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, query, asPath } = router

  const [changeUserLocale] = useMutation(ChangeUserLocaleDocument)

  return (
    <SimpleSetting
      label={t('manage.settings.languageSettings')}
      tooltip={t('manage.settings.languageTooltip')}
    >
      <Select
        value={user?.locale || 'en'}
        onChange={(newLocale: string) => {
          changeUserLocale({
            variables: { locale: newLocale as LocaleType },
          })
          router.push({ pathname, query }, asPath, {
            locale: newLocale,
          })
        }}
        items={[
          {
            label: t('shared.generic.english'),
            value: 'en',
            data: { cy: 'language-en' },
          },
          {
            label: t('shared.generic.german'),
            value: 'de',
            data: { cy: 'language-de' },
          },
        ]}
        className={{
          content: 'font-normal text-black',
          trigger: 'font-normal text-black',
        }}
        data={{ cy: 'language-select' }}
      />
    </SimpleSetting>
  )
}

export default LanguageSetting
