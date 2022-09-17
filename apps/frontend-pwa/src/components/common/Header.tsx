import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2 } from '@uzh-bf/design-system'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface HeaderProps {
  participant?: Participant
  title?: string
  courseName?: string
  courseColor?: string
}

const defaultProps = {
  title: undefined,
  courseColor: undefined,
}

function Header({
  participant,
  title,
  courseName,
  courseColor,
}: HeaderProps): React.ReactElement {
  return (
    <div
      style={{ borderColor: courseColor ?? 'green' }}
      className="flex flex-row items-center justify-between h-16 px-4 text-white border-b-8 bg-slate-800"
    >
      {title && courseName && (
        <div>
          <H1 className="m-0 text-sm text-uzh-grey-60">{courseName}</H1>
          <H2 className="m-0 text-base">{title}</H2>
        </div>
      )}

      {title && !courseName && <H1 className="text-lg">{title}</H1>}

      <div className="flex flex-row items-center gap-4">
        {participant ? (
          <Link href="/">
            <Button className="hidden text-white bg-slate-800 md:block">
              Home
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button className="text-white bg-slate-800">Login</Button>
          </Link>
        )}
        {participant ? (
          <Link href="/profile" className="">
            <Image
              src={
                participant?.avatar
                  ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${participant.avatar}.svg`
                  : '/placeholder.png'
              }
              alt=""
              width="45"
              height="45"
              className="bg-white rounded-full cursor-pointer hover:bg-uzh-red-20"
            />
          </Link>
        ) : (
          <Link href="/login" className="">
            <Image
              src="/placeholder.png"
              alt=""
              width="45"
              height="45"
              className="bg-white rounded-full cursor-pointer hover:bg-uzh-red-20"
            />
          </Link>
        )}
      </div>
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
