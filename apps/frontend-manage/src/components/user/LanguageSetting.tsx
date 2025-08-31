import { useMutation } from '@apollo/client'
import {
  ChangeUserLocaleDocument,
  LocaleType,
  User,
  UserProfileDocument,
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
  const [changeUserLocale, { loading: changingLanguage }] = useMutation(
    ChangeUserLocaleDocument
  )

  return (
    <SimpleSetting
      label={t('manage.settings.languageSettings')}
      tooltip={t('manage.settings.languageTooltip')}
    >
      <Select
        disabled={changingLanguage}
        value={user?.locale || 'en'}
        onChange={(newLocale: string) => {
          changeUserLocale({
            variables: { locale: newLocale as LocaleType },
            optimisticResponse: {
              __typename: 'Mutation',
              changeUserLocale: {
                __typename: 'User',
                id: user.id,
                locale: newLocale as LocaleType,
              },
            },
            update: (cache, { data }) => {
              // verify that the language change was successful
              if (!data?.changeUserLocale) return

              // update the cache with the new user data
              cache.updateQuery({ query: UserProfileDocument }, (qData) => {
                if (!qData?.userProfile) return qData

                return {
                  ...qData,
                  userProfile: {
                    ...qData.userProfile,
                    locale: data.changeUserLocale!.locale,
                  },
                }
              })
            },
          })
          router.push({ pathname, query }, asPath, { locale: newLocale })
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
          trigger: 'h-8 w-max font-normal text-black',
          item: 'h-8',
        }}
        data={{ cy: 'language-select' }}
      />
    </SimpleSetting>
  )
}

export default LanguageSetting
