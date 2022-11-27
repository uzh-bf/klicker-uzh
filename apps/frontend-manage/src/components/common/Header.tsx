import { useMutation, useQuery } from '@apollo/client'
import { faPlayCircle, faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  LogoutUserDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  user: User
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const [logoutUser] = useMutation(LogoutUserDocument)

  const userDropdownContent = [
    { name: 'Settings', onClick: () => router.push('/settings') },
    { name: 'Support', onClick: () => router.push('/support') },
    {
      name: 'Logout',
      onClick: async () => {
        const userIdLogout = await logoutUser()
        userIdLogout.data?.logoutUser
          ? router.push('https://www.klicker.uzh.ch')
          : console.log('Logout failed')
      },
    },
  ]

  const { data } = useQuery(GetRunningSessionsDocument, {
    variables: { shortname: user.shortname },
  })

  return (
    <div className="flex flex-row items-center justify-between w-full h-full px-4 font-bold text-white bg-slate-800 print:hidden">
      <div>
        <Link href="/" legacyBehavior>
          <Button className="mr-2 border-none bg-slate-800">
            <Button.Label>Fragepool</Button.Label>
          </Button>
        </Link>
        <Link href="/sessions" prefetch legacyBehavior>
          <Button
            className="mr-2 border-none bg-slate-800"
            onClick={() => router.push('/sessions')}
          >
            <Button.Label>Sessionen</Button.Label>
          </Button>
        </Link>
        <Link href="/courses" prefetch legacyBehavior>
          <Button className="mr-2 border-none bg-slate-800">
            <Button.Label>Kurse</Button.Label>
          </Button>
        </Link>
      </div>
      <div className="flex flex-row gap-4">
        <Dropdown
          trigger={
            <Button
              disabled={
                !data?.runningSessions || data.runningSessions.length === 0
              }
              className={twMerge(
                'flex flex-row items-center justify-center p-2 border-none',
                'rounded bg-slate-800 h-9 w-9',
                data?.runningSessions?.length > 0 &&
                  'text-green-600 hover:text-uzh-blue-100 hover:bg-uzh-blue-40'
              )}
            >
              <FontAwesomeIcon icon={faPlayCircle} className="h-7" />
            </Button>
          }
          items={
            data?.runningSessions && data?.runningSessions.length > 0
              ? data?.runningSessions.map((session) => {
                  return {
                    label: session.name,
                    onClick: () =>
                      router.push(`sessions/${session.id}/cockpit`),
                  }
                })
              : []
          }
          className={{
            viewport:
              'bg-white text-black pt-0 border border-solid border-uzh-grey-80',
            item: 'text-black hover:!text-uzh-blue-100 hover:bg-uzh-blue-20',
          }}
        />

        <Dropdown
          trigger={
            <div
              className={twMerge(
                'flex flex-row items-center gap-2 px-3 border border-white border-solid',
                'rounded py-auto h-9 bg-slate-800 hover:bg-uzh-blue-20 hover:text-uzh-blue-100'
              )}
            >
              <FontAwesomeIcon icon={faUserCircle} size="lg" />
              <div>{user.shortname}</div>
            </div>
          }
          items={userDropdownContent.map((item) => {
            return { label: item.name, onClick: () => item.onClick() }
          })}
          className={{
            viewport:
              'bg-white text-black pt-0 border border-solid border-uzh-grey-80',
            item: 'text-black hover:!text-uzh-blue-80 hover:bg-uzh-blue-20 px-3',
          }}
        />
      </div>
    </div>
  );
}

export default Header
