import { useMutation, useQuery } from '@apollo/client'
import { faPlayCircle, faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  LogoutUserDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  user: User
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const [logoutUser] = useMutation(LogoutUserDocument)

  const { data } = useQuery(GetRunningSessionsDocument, {
    variables: { shortname: user.shortname },
  })

  return (
    <div
      className="flex flex-row items-center justify-between w-full h-full px-4 font-bold text-white bg-slate-800"
      data-cy="navigation"
    >
      <Navigation className={{ root: 'bg-slate-800' }}>
        <Navigation.ButtonItem
          href="/"
          label="Fragepool"
          className={{ label: 'font-bold text-white text-base' }}
        />
        <Navigation.ButtonItem
          href="/sessions"
          label="Sessionen"
          className={{ label: 'font-bold text-white text-base' }}
        />
        <Navigation.ButtonItem
          href="/courses"
          label="Kurse"
          className={{ label: 'font-bold text-white text-base' }}
        />
      </Navigation>
      <Navigation className={{ root: '!p-0 bg-slate-800' }}>
        <Navigation.TriggerItem
          icon={
            <FontAwesomeIcon
              icon={faPlayCircle}
              className="h-7 group-hover:text-white"
            />
          }
          dropdownWidth="w-[12rem]"
          className={{
            root: 'h-10 w-10 group',
            icon: twMerge(
              'text-uzh-grey-80',
              data?.runningSessions?.length !== 0 && 'text-green-600'
            ),
            disabled: '!text-gray-400',
            dropdown: 'p-1.5 gap-0',
          }}
          disabled={data?.runningSessions?.length === 0}
        >
          {data?.runningSessions && data?.runningSessions.length > 0 ? (
            data?.runningSessions.map((session) => {
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
        <Navigation.TriggerItem
          icon={<FontAwesomeIcon icon={faUserCircle} className="h-5" />}
          label={user.shortname}
          dropdownWidth="w-[12rem]"
          className={{
            label: 'font-bold text-white text-base my-auto',
            icon: 'text-white',
            root: 'flex flex-row items-center gap-1',
            dropdown: 'p-1.5 gap-0',
          }}
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
            title="Login-Token generieren"
            href="/token"
            className={{ title: 'text-base font-bold', root: 'p-2' }}
          />
          <Navigation.DropdownItem
            title="Logout"
            onClick={async () => {
              const userIdLogout = await logoutUser()
              userIdLogout.data?.logoutUser
                ? router.push('https://www.klicker.uzh.ch')
                : console.log('Logout failed')
            }}
            className={{ title: 'text-base font-bold', root: 'p-2' }}
          />
        </Navigation.TriggerItem>
      </Navigation>
    </div>
  )
}

export default Header
