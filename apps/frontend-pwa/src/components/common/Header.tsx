import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface HeaderProps {
  participant?: Participant
  title?: string
  courseName?: string
}

const defaultProps = { title: undefined }

function Header({
  participant,
  title,
  courseName,
}: HeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row items-center justify-between w-full h-full px-2 py-1 font-bold text-white bg-slate-800">
      {title && courseName && (
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
      )}
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
