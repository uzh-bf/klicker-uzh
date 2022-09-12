import { Participant } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface HeaderProps {
  participant?: Participant
  title?: string
}

const defaultProps = { title: undefined }

function Header({ participant, title }: HeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row items-center justify-between w-full h-full px-2 py-1 font-bold text-white bg-slate-800">
      <div className="w-28">KlickerUZH</div>
      <div className="hidden md:block">{title}</div>
      {participant ? (
        <Link href="/profile">
          <a className="text-right w-28">
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
