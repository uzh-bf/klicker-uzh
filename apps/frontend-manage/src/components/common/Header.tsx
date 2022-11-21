import { useMutation, useQuery } from '@apollo/client'
import { faPlayCircle, faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  LogoutUserDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import React, { useState } from 'react'

interface HeaderProps {
  user: User
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const [userDropdown, setUserDropdown] = useState(false)
  const [runningDropdown, setRunningDropdown] = useState(false)
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
    <div className="flex flex-row items-center justify-between w-full h-full px-4 py-1 font-bold text-white bg-slate-800 print:hidden">
      <div>
        <Button
          className="mr-2 border-none bg-slate-800"
          onClick={() => router.push('/')}
        >
          <Button.Label>Fragepool</Button.Label>
        </Button>
        <Button
          className="border-none bg-slate-800"
          onClick={() => router.push('/sessions')}
        >
          <Button.Label>Sessions</Button.Label>
        </Button>
      </div>
      <div className="flex flex-row gap-4">
        <Dropdown
          disabled={
            !data?.runningSessions || data?.runningSessions.length === 0
          }
          trigger={
            <div className="flex flex-row items-center justify-center p-2 text-green-600 border-none rounded bg-slate-800 hover:text-uzh-blue-100 hover:bg-uzh-blue-40 h-9 w-9">
              <FontAwesomeIcon icon={faPlayCircle} className="h-7" />
            </div>
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

        <DropdownMenu.Root open={userDropdown} onOpenChange={setUserDropdown}>
          <DropdownMenu.Trigger className="h-full">
            <Button className="my-auto h-9 bg-slate-800">
              <Button.Icon className="mr-2">
                <FontAwesomeIcon icon={faUserCircle} size="lg" />
              </Button.Icon>
              <Button.Label>{user.shortname}</Button.Label>
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Content className="flex flex-col p-1 bg-white border border-t-0 border-solid rounded-md border-uzh-grey-80">
            <DropdownMenu.Item className="[all:_unset]" onClick={() => null}>
              {userDropdownContent.map((item) => (
                <div
                  className="flex flex-col w-full h-8 px-4 text-black rounded-md cursor-pointer hover:bg-uzh-blue-40 hover:text-uzh-blue-100"
                  key={item.name}
                >
                  <a onClick={item.onClick} className="my-auto text-center">
                    {item.name}
                  </a>
                </div>
              ))}
            </DropdownMenu.Item>

            <DropdownMenu.Arrow className="fill-white" />
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}

export default Header
