import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2 } from '@uzh-bf/design-system'
import Image from 'next/image'
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

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <div
      style={{ borderColor: courseColor || undefined }}
      className={twMerge(
        'flex flex-row items-center justify-between h-16 px-4 text-white bg-slate-800 border-b-8',
        !courseColor && 'border-uzh-red-60'
      )}
    >
      {title && courseName && (
        <div>
          <H1 className="m-0 text-sm text-uzh-grey-60">{courseName}</H1>
          <H2 className="m-0 text-base">{title}</H2>
        </div>
      )}

      {title && !courseName && <H1 className="mb-0 text-xl">{title}</H1>}

      <div className="flex flex-row items-center gap-4">
        {/* <Image src="/bf_icon.svg" width={30} height={30} /> */}
        {participant ? (
          router.pathname !== '/' &&
          (pageInFrame ? (
            <Button
              className="hidden text-white bg-slate-800 md:block"
              onClick={() => router.back()}
            >
              Zurück
            </Button>
          ) : (
            <Link href="/" legacyBehavior>
              <Button className="hidden text-white bg-slate-800 md:block">
                Home
              </Button>
            </Link>
          ))
        ) : (
          <Link href="/login" legacyBehavior>
            <Button className="text-white bg-slate-800">Login</Button>
          </Link>
        )}
        {participant && !participant?.avatar && (
          <Link href="/editProfile" legacyBehavior>
            <Button className="hidden text-white bg-uzh-red-100 border-uzh-red-100 md:block">
              Profil einrichten
            </Button>
          </Link>
        )}
        <Link
          href={participant ? '/profile' : '/login'}
          className=""
          legacyBehavior
        >
          <Image
            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
              participant?.avatar ?? 'placeholder'
            }.svg`}
            alt=""
            width="45"
            height="45"
            className="bg-white rounded-full cursor-pointer hover:bg-uzh-red-20"
          />
        </Link>
      </div>
    </div>
  )
}

Header.defaultProps = defaultProps

export default Header
