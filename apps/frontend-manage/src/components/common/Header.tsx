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
      label: t('manage.general.questionPool'),
      active: router.pathname == '/',
      cy: 'questions',
    },
    {
      href: '/sessions',
      label: t('manage.general.sessions'),
      active: router.pathname == '/sessions',
      cy: 'sessions',
    },
    {
      href: '/courses',
      label: t('manage.general.courses'),
      active: router.pathname == '/courses',
      cy: 'courses',
    },
  ]

  return (
    <div
      className="flex h-full w-full flex-row items-center justify-between bg-slate-800 px-4 font-bold text-white print:!hidden"
      data-cy="navigation"
    >
      <Navigation className={{ root: 'bg-slate-800' }}>
        {navigationItems.map((item) => (
          <Navigation.ButtonItem
            data={{ cy: item.cy }}
            key={item.href}
            label={item.label}
            className={{
              label: twMerge(
                'bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-base font-bold transition-all duration-500 ease-out group-hover:bg-[length:100%_2px]',
                item.active &&
                  'text-red underline decoration-2 underline-offset-[0.3rem]'
              ),
              root: 'group text-white transition-all duration-300 ease-in-out hover:bg-inherit',
            }}
            onClick={() => {
              router.push(item.href)
            }}
          />
        ))}
      </Navigation>
      <Navigation className={{ root: 'bg-slate-800 !p-0' }}>
        <Navigation.ButtonItem
          onClick={() => router.push('/migration')}
          label={t('manage.general.migration')}
          className={{
            label: twMerge(
              'bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-base font-bold transition-all duration-500 ease-out group-hover:bg-[length:100%_2px]',
              router.pathname === '/migration' &&
                'text-red underline decoration-2 underline-offset-[0.3rem]'
            ),
            root: 'group text-white transition-all duration-300 ease-in-out hover:bg-inherit',
          }}
        />
        <div className="hidden md:block">
          <Navigation.TriggerItem
            icon={
              <FontAwesomeIcon
                icon={faPlayCircle}
                className="h-7 group-hover:text-white"
              />
            }
            dropdownWidth="w-[12rem]"
            className={{
              root: 'group h-10 w-2',
              icon: twMerge(
                'text-uzh-grey-80',
                data?.userRunningSessions?.length !== 0 && 'text-green-600'
              ),
              disabled: '!text-gray-400',
              dropdown: 'gap-0 p-1.5',
            }}
            disabled={data?.userRunningSessions?.length === 0}
          >
            {data?.userRunningSessions &&
            data?.userRunningSessions.length > 0 ? (
              data?.userRunningSessions.map((session) => {
                return (
                  <Navigation.DropdownItem
                    key={session.id}
                    title={session.name}
                    onClick={() =>
                      router.push(`/sessions/${session.id}/cockpit`)
                    }
                    className={{ title: 'text-base font-bold', root: 'p-2' }}
                  />
                )
              })
            ) : (
              <div />
            )}
          </Navigation.TriggerItem>
        </div>
        <Navigation.ButtonItem
          onClick={() => setShowSupportModal(true)}
          label=""
          icon={<FontAwesomeIcon icon={faQuestionCircle} className="h-7" />}
          className={{
            root: 'hover:text-uzh-blue-40 -mt-1 hidden h-7 bg-transparent text-white hover:bg-transparent group-hover:text-white md:block',
          }}
        />
        <Navigation.TriggerItem
          icon={<FontAwesomeIcon icon={faUserCircle} className="h-5" />}
          label={user?.shortname}
          dropdownWidth="w-[16rem]"
          className={{
            label:
              'my-auto bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-base font-bold transition-all duration-500 ease-out group-hover:bg-[length:100%_2px]',
            root: 'group flex flex-row items-center gap-1 text-white transition-all duration-300 ease-in-out hover:bg-inherit',
            dropdown: 'gap-0 p-1.5',
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
