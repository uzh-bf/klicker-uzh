import { faCircleLeft } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import Image from 'next/image'
import Link from 'next/link'
import Router from 'next/router'
import React from 'react'

interface MobileHeaderProps {
  participant?: Participant
}

function MobileHeader({ participant }: MobileHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row justify-between w-full h-full gap-1 bg-uzh-grey-60">
      <Button
        className="flex flex-row my-auto border-0 shadow-none h-14 bg-uzh-grey-60"
        onClick={() => Router.back()}
      >
        <FontAwesomeIcon icon={faCircleLeft} className="my-auto mr-1 h-7" />
        <div className="my-auto">Zurück</div>
      </Button>

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
