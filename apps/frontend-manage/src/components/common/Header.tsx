import { useMutation, useQuery } from '@apollo/client'
import { faPlayCircle, faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetRunningSessionsDocument,
  GetUserCoursesDocument,
  LogoutUserDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  user: User
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const [logoutUser] = useMutation(LogoutUserDocument)

  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

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
        <Button
          className="mr-2 border-none bg-slate-800"
          onClick={() => router.push('/')}
        >
          <Button.Label>Fragepool</Button.Label>
        </Button>
        <Button
          className="mr-2 border-none bg-slate-800"
          onClick={() => router.push('/sessions')}
        >
          <Button.Label>Sessions</Button.Label>
        </Button>
        {(dataCourses?.userCourses || loadingCourses) && (
          <Dropdown
            disabled={!dataCourses?.userCourses || loadingCourses}
            trigger="Kurse"
            items={
              dataCourses?.userCourses
                ? dataCourses.userCourses.map((course) => {
                    return {
                      label: course.displayName,
                      onClick: () => router.push(`courses/${course.id}`),
                    }
                  })
                : []
            }
            className={{
              trigger: 'border-none hover:text-uzh-blue-100',
              viewport:
                'bg-white text-black pt-0 border border-solid border-uzh-grey-80',
              item: 'text-black hover:!text-uzh-blue-100 hover:bg-uzh-blue-20',
            }}
          />
        )}
      </div>
      <div className="flex flex-row gap-4">
        <Dropdown
          disabled={
            !data?.runningSessions || data?.runningSessions.length === 0
          }
          trigger={
            <div
              className={twMerge(
                'flex flex-row items-center justify-center p-2 text-green-600 border-none',
                'rounded bg-slate-800 hover:text-uzh-blue-100 hover:bg-uzh-blue-40 h-9 w-9'
              )}
            >
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
  )
}

export default Header
