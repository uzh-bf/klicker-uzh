import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2 } from '@uzh-bf/design-system'
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
    <div className="flex flex-row items-center justify-between w-full h-full px-4 py-2 text-white bg-slate-800">
      {title && courseName && (
        <div>
          <H1 className="mt-1 text-sm font-normal text-uzh-grey-60">
            {courseName}
          </H1>
          <H2 className="mb-0 text-base">{title}</H2>
        </div>
      )}
      {title && !courseName && <H1 className="text-lg">{title}</H1>}
      <div className="flex flex-row items-center gap-4">
        <Link href="/">
          <Button className="hidden text-white bg-slate-800 md:block">
            Home
          </Button>
        </Link>
        {participant ? (
          <Link href="/profile">
            <Image
              src={
                `https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/${participant.avatar}_small.webp` ||
                '/placeholder.png'
              }
              alt="logo"
              width="50"
              height="50"
              className="bg-white rounded-full "
            />
          </Link>
        ) : (
          <Link href="/login">
            <a className="">
              <Image
                src={'/placeholder.png'}
                alt="logo"
                width="45"
                height="45"
              />
            </a>
          </Link>
        )}
      </div>
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
