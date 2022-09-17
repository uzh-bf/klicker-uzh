import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2 } from '@uzh-bf/design-system'
import Image from 'next/future/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  participant?: Participant
  title?: string
  courseName?: string
  courseColor?: string | null
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
  const router = useRouter()
  return (
    <div
      style={{ borderColor: courseColor || undefined }}
      className={twMerge("flex flex-row items-center justify-between h-16 px-4 text-white bg-slate-800", courseColor && 'border-b-8')}
    >

      {title && courseName && (
        <div>
          <H1 className="m-0 text-sm text-uzh-grey-60">{courseName}</H1>
          <H2 className="m-0 text-base">{title}</H2>
        </div>
      )}

      {title && !courseName && <H1 className="mb-0 text-xl">{title}</H1>}

      <div className="flex flex-row items-center gap-4">
        {participant ? (
          router.pathname !== '/' && (
            <Link href="/">
              <Button className="hidden text-white bg-slate-800 md:block">
                Home
              </Button>
            </Link>
          )
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
