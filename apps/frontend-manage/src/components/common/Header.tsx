import { useMutation, useQuery } from '@apollo/client'
import { faPlayCircle, faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeUserLocaleDocument,
  GetUserRunningSessionsDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Navigation, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  user?: User | null
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const t = useTranslations()
  const { pathname, asPath, query } = router

  const [changeUserLocale] = useMutation(ChangeUserLocaleDocument)

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
      className="flex flex-row items-center justify-between w-full h-full px-4 font-bold text-white bg-slate-800 print:!hidden"
      data-cy="navigation"
    >
      <Navigation className={{ root: 'bg-slate-800' }}>
        {navigationItems.map((item) => (
          <Navigation.ButtonItem
            data={{ cy: item.cy }}
            key={item.href}
            href={item.href}
            label={item.label}
            className={{
              label: twMerge(
                'font-bold text-base bg-left-bottom bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out',
                item.active &&
                  'text-red underline underline-offset-[0.3rem] decoration-2'
              ),
              root: 'group text-white hover:bg-inherit transition-all duration-300 ease-in-out',
            }}
          />
        ))}
      </Navigation>
      <Navigation className={{ root: '!p-0 bg-slate-800' }}>
        <div className="hidden md:block">
          <Navigation.TriggerItem
            icon={
              <FontAwesomeIcon
                icon={faPlayCircle}
                className="h-7 sm:group-hover:text-white"
              />
            }
            dropdownWidth="w-[12rem]"
            className={{
              root: 'h-10 w-10 group',
              icon: twMerge(
                'text-uzh-grey-80',
                data?.userRunningSessions?.length !== 0 && 'text-green-600'
              ),
              disabled: '!text-gray-400',
              dropdown: 'p-1.5 gap-0',
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
                    href={`/sessions/${session.id}/cockpit`}
                    className={{ title: 'text-base font-bold', root: 'p-2' }}
                  />
                )
              })
            ) : (
              <div />
            )}
          </Navigation.TriggerItem>
        </div>
        <Navigation.TriggerItem
          icon={<FontAwesomeIcon icon={faUserCircle} className="h-5" />}
          label={user?.shortname}
          dropdownWidth="w-[12rem]"
          className={{
            label:
              'my-auto font-bold text-base bg-left-bottom bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out',
            root: 'group flex flex-row items-center gap-1 text-white hover:bg-inherit transition-all duration-300 ease-in-out',
            dropdown: 'p-1.5 gap-0',
          }}
          data={{ cy: 'user-menu' }}
        >
          {/* <Navigation.DropdownItem
            title="Settings"
            href="/settings"
            className={{ title: 'text-base font-bold', root: 'p-2' }}
          />
          <Navigation.DropdownItem
            title="Support"
            href="/support"
            className={{ title: 'text-base font-bold', root: 'p-2' }}
          /> */}
          <Navigation.DropdownItem
            title={t('manage.general.generateToken')}
            href="/token"
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
        <Select
          value={router.locale}
          items={[
            { value: 'de', label: 'DE' },
            { value: 'en', label: 'EN' },
          ]}
          onChange={(newValue: string) => {
            changeUserLocale({ variables: { locale: newValue } })
            router.push({ pathname, query }, asPath, {
              locale: newValue,
            })
          }}
          className={{
            root: 'my-auto',
            trigger:
              'text-white underline underline-offset-[0.3rem] decoration-2 rounded-none sm:hover:bg-transparent sm:hover:text-white',
          }}
          basic
        />
      </Navigation>
    </div>
  )
}

export default Header
