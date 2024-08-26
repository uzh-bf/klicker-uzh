import { useQuery } from '@apollo/client'
import {
  faPlayCircle,
  faQuestionCircle,
  faUserCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetUserRunningSessionsDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SupportModal from './SupportModal'

interface HeaderProps {
  user?: User | null
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const t = useTranslations()
  const [showSupportModal, setShowSupportModal] = useState(false)

  const { data } = useQuery(GetUserRunningSessionsDocument)

  const navigationItems = [
    {
      href: '/',
      label: t('manage.general.library'),
      active: router.pathname == '/',
      cy: 'library',
    },
    {
      href: '/quizzes',
      label: t('manage.general.quizzes'),
      active: router.pathname == '/quizzes',
      cy: 'quizzes',
    },
    {
      href: '/courses',
      label: t('manage.general.courses'),
      active: router.pathname == '/courses',
      cy: 'courses',
    },
    {
      href: '/analytics',
      label: t('manage.general.analytics'),
      active: router.pathname == '/analytics',
      cy: 'analytics',
    },
  ]

  return (
    <div
      className="border-b border-slate-300 flex flex-row items-center justify-between w-full h-full font-bold bg-slate-100 text-slate-700 print:!hidden"
      data-cy="navigation"
    >
      <Navigation
        className={{
          root: 'bg-slate-100 rounded-none',
        }}
      >
        {navigationItems.map((item) => (
          <Navigation.ButtonItem
            data={{ cy: item.cy }}
            key={item.href}
            label={item.label}
            className={{
              label: twMerge(
                'text-base bg-left-bottom bg-gradient-to-r from-slate-700 to-slate-700 text-slate-700 bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out',
                item.active &&
                  'underline underline-offset-[0.3rem] decoration-2'
              ),
              root: 'group text-slate-700 hover:bg-inherit transition-all duration-300 ease-in-out',
            }}
            onClick={() => {
              router.push(item.href)
            }}
          />
        ))}
      </Navigation>
      <Navigation
        className={{
          root: 'rounded-none bg-slate-100',
        }}
      >
        <Navigation.TriggerItem
          icon={
            <FontAwesomeIcon
              icon={faPlayCircle}
              className="h-5 group-hover:text-white"
            />
          }
          dropdownWidth="w-36"
          className={{
            root: 'hidden md:block h-9 w-9 group',
            icon: twMerge(
              data?.userRunningSessions?.length !== 0 && 'text-green-600'
            ),
            disabled: '!text-gray-400',
          }}
          disabled={data?.userRunningSessions?.length === 0}
        >
          {data?.userRunningSessions && data?.userRunningSessions.length > 0 ? (
            data?.userRunningSessions.map((session) => {
              return (
                <Navigation.DropdownItem
                  key={session.id}
                  title={session.name}
                  onClick={() => router.push(`/quizzes/${session.id}/cockpit`)}
                  className={{ title: 'text-base font-bold', root: 'p-2' }}
                />
              )
            })
          ) : (
            <div />
          )}
        </Navigation.TriggerItem>
        <Navigation.ButtonItem
          onClick={() => setShowSupportModal(true)}
          label=""
          icon={<FontAwesomeIcon icon={faQuestionCircle} className="h-5" />}
          className={{
            root: 'hidden md:block h-9 group-hover:text-white bg-transparent hover:bg-transparent text-slate-700 hover:text-uzh-blue-100',
          }}
        />
        <Navigation.TriggerItem
          icon={
            <FontAwesomeIcon
              icon={faUserCircle}
              className="h-5 text-slate-700"
            />
          }
          label={user?.shortname}
          dropdownWidth="w-[16rem]"
          className={{
            label:
              'text-base bg-left-bottom bg-gradient-to-r from-slate-700 to-slate-700 bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out text-slate-700',
            root: 'group flex flex-row items-center gap-1 text-slate-700 hover:bg-inherit transition-all duration-300 ease-in-out',
            dropdown: 'p-1.5 gap-0',
          }}
          data={{ cy: 'user-menu' }}
        >
          <Navigation.DropdownItem
            title={t('shared.generic.settings')}
            onClick={() => router.push('/user/settings')}
            className={{ title: 'text-base font-bold', root: 'p-2' }}
            data={{ cy: 'menu-user-settings' }}
          />
          <Navigation.DropdownItem
            title={t('manage.general.generateToken')}
            onClick={() => router.push('/token')}
            className={{ title: 'text-base font-bold', root: 'p-2' }}
            data={{ cy: 'token-generation-page' }}
          />
          <Navigation.DropdownItem
            title={t('shared.generic.logout')}
            onClick={async () => {
              router.push(process.env.NEXT_PUBLIC_AUTH_URL + '/logout')
            }}
            className={{ title: 'text-base font-bold', root: 'p-2' }}
            data={{ cy: 'logout' }}
          />
        </Navigation.TriggerItem>
      </Navigation>
      <SupportModal
        open={showSupportModal}
        setOpen={setShowSupportModal}
        user={user}
      />
    </div>
  )
}

export default Header
