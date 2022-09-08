import { Participant } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface MobileHeaderProps {
  participant?: Participant
}

function MobileHeader({ participant }: MobileHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row justify-between w-full h-full gap-1 bg-uzh-grey-60">
      <div>KlickerUZH</div>
      {participant ? (
        <Link href="/profile">
          <a className="mt-1 mr-2">
            <Image
              src={`/${participant.avatar}` || '/placeholder.png'}
              alt="logo"
              width="50"
              height="50"
              className="rounded-full"
            />
          </a>
        </Link>
      ) : (
        <Link href="/login">
          <a className="mt-1 mr-2">
            <Image src={'/placeholder.png'} alt="logo" width="50" height="50" />
          </a>
        </Link>
      )}
    </div>
  )
}

export default MobileHeader
