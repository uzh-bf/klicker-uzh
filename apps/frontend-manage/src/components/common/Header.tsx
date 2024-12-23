import { useQuery } from '@apollo/client'
import {
  faPlayCircle,
  faQuestionCircle,
  faUserCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetUserRunningLiveQuizzesDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
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

  const { data } = useQuery(GetUserRunningLiveQuizzesDocument)
  const quizzes = data?.userRunningLiveQuizzes

  const navigationItems = [
    {
      href: '/',
      label: t('manage.general.library'),
      active: router.pathname == '/',
      cy: 'library',
    },
    {
      href: '/quizzes',
      label: t('manage.general.liveQuizzes'),
      active: router.pathname == '/quizzes',
      cy: 'live-quizzes',
    },
    {
      href: '/courses',
      label: t('manage.general.courses'),
      active: router.pathname == '/courses',
      cy: 'courses',
    },
    ...(user?.featurePreview
      ? [
          {
            new: true,
            href: '/analytics',
            label: t('manage.general.analytics'),
            active: router.pathname == '/analytics',
            cy: 'analytics',
          },
        ]
      : []),
  ]

  return (
    <div
      className="flex h-full w-full flex-row items-center justify-between border-b border-slate-300 bg-slate-100 font-bold text-slate-700 print:!hidden"
      data-cy="navigation"
    >
      <Navigation
        className={{
          root: 'rounded-none bg-slate-100',
        }}
      >
        {navigationItems.map((item) => (
          <Navigation.ButtonItem
            data={{ cy: item.cy }}
            key={item.href}
            label={
              <div className="flex items-center gap-2">
                {item.label}
                {item.new && (
                  <Badge className="py-0.25 rounded bg-green-700 px-1.5 text-xs font-semibold text-white hover:bg-green-800">
                    {t('shared.generic.new')}
                  </Badge>
                )}
              </div>
            }
            className={{
              label: twMerge(
                'bg-gradient-to-r from-slate-700 to-slate-700 bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-base text-slate-700 transition-all duration-500 ease-out group-hover:bg-[length:100%_2px]',
                item.active &&
                  'underline decoration-2 underline-offset-[0.3rem]'
              ),
              root: 'group text-slate-700 transition-all duration-300 ease-in-out hover:bg-inherit',
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
        <div className="hidden md:block">
          <Navigation.TriggerItem
            icon={
              <FontAwesomeIcon
                icon={faPlayCircle}
                className="h-5 group-hover:text-white"
              />
            }
            dropdownWidth="w-36"
            className={{
              root: 'group hidden h-9 w-9 md:block',
              icon: twMerge(
                'text-uzh-grey-80',
                quizzes?.length !== 0 && 'text-green-600'
              ),
              disabled: '!text-gray-400',
            }}
            disabled={quizzes?.length === 0}
          >
            {quizzes && quizzes.length > 0 ? (
              quizzes.map((quiz) => {
                return (
                  <Navigation.DropdownItem
                    key={quiz.id}
                    title={quiz.name}
                    onClick={() => router.push(`/quizzes/${quiz.id}/cockpit`)}
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
          icon={<FontAwesomeIcon icon={faQuestionCircle} className="h-5" />}
          className={{
            root: 'hover:text-uzh-blue-100 hidden h-9 bg-transparent text-slate-700 hover:bg-transparent group-hover:text-white md:block',
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
              'bg-gradient-to-r from-slate-700 to-slate-700 bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-base text-slate-700 transition-all duration-500 ease-out group-hover:bg-[length:100%_2px]',
            root: 'group flex flex-row items-center gap-1 text-slate-700 transition-all duration-300 ease-in-out hover:bg-inherit',
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
