import { useMutation } from '@apollo/client'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LogoutUserDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { iconButtonClass } from '../common/styles'
import PageContainer from './PageContainer'

function HomeHeader() {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, asPath, query } = router
  const [logoutUser, { loading: loggingOut }] = useMutation(LogoutUserDocument)

  return (
    <div className="border-ctrl-border sticky top-0 z-20 border-b bg-white pt-[env(safe-area-inset-top)]">
      <PageContainer className="flex items-center gap-2.5 py-2.5">
        <span
          aria-hidden
          className="bg-uzh-blue flex h-7 w-7 items-center justify-center rounded-md text-[15px] font-bold text-white"
        >
          K
        </span>
        <span className="text-ctrl-ink flex-1 truncate text-base font-bold">
          {t('control.home.appName')}
        </span>
        <Select
          basic
          value={router.locale}
          items={[
            { value: 'de', label: 'DE', data: { cy: 'language-de' } },
            { value: 'en', label: 'EN', data: { cy: 'language-en' } },
          ]}
          onChange={(newValue: string) =>
            router.push({ pathname, query }, asPath, { locale: newValue })
          }
          className={{ trigger: 'text-ctrl-ink-2 h-9 w-max text-sm' }}
          data={{ cy: 'language-select' }}
        />
        <Button
          disabled={loggingOut}
          onClick={async () => {
            const result = await logoutUser()
            if (result.data?.logoutUser) {
              router.push('https://www.klicker.uzh.ch')
            }
          }}
          className={{ root: iconButtonClass }}
          aria-label={t('shared.generic.logout')}
          data={{ cy: 'logout-control-button' }}
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
        </Button>
      </PageContainer>
    </div>
  )
}

export default HomeHeader
