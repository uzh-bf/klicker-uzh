import { faUserCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { User } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import React from 'react'

interface HeaderProps {
  displayName: string
  user: User
}

const defaultProps = {}

function Header({ displayName, user }: HeaderProps): React.ReactElement {
  const router = useRouter()

  return (
    <div className="flex flex-row items-center justify-between w-full h-full px-4 py-1 font-bold text-white bg-slate-800">
      <div>{displayName}</div>
      <Button className="bg-slate-800" onClick={() => router.push('/profile')}>
        <Button.Icon className="mr-2">
          <FontAwesomeIcon icon={faUserCircle} size="lg" />
        </Button.Icon>
        <Button.Label className="">{user.shortname}</Button.Label>
      </Button>
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
