import { User } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'

interface HeaderProps {
  user?: User
}

const defaultProps = { user: undefined }

function Header({ user }: HeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row items-center justify-between w-full h-full px-2 py-1 font-bold text-white bg-slate-800">
      {/* {title && courseName && (
        <div className="flex flex-col">
          <div className="text-sm font-normal text-uzh-grey-60">
            {courseName}
          </div>
          <H3>{title}</H3>
        </div>
      )}
      {title && !courseName && <div>{title}</div>}
      {participant ? (
        <Link href="/profile">
          <a className="text-right">
            <Image
              src={`/${participant.avatar}` || '/placeholder.png'}
              alt="logo"
              width="45"
              height="45"
              className="rounded-full"
            />
          </a>
        </Link>
      ) : (
        <Link href="/login">
          <a className="">
            <Image src={'/placeholder.png'} alt="logo" width="45" height="45" />
          </a>
        </Link>
      )} */}
      Test
      {user?.id}
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
