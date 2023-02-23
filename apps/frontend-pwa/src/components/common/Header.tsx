import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Course, Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2, Select, ThemeContext } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface HeaderProps {
  participant?: Partial<Participant>
  title?: string
  course?: Partial<Course>
}

function Header({
  participant,
  title,
  course,
}: HeaderProps): React.ReactElement {
  const router = useRouter()
  const { pathname, asPath, query } = router
  const theme = useContext(ThemeContext)
  const t = useTranslations()

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <div
      style={{ borderColor: course?.color || undefined }}
      className={twMerge(
        'flex flex-row items-center justify-between h-16 px-4 text-white bg-slate-800 border-b-8',
        !course?.color && 'border-uzh-red-60'
      )}
    >
      {title && course?.displayName && (
        <div>
          <H1 className={{ root: 'm-0 text-sm text-uzh-grey-60' }}>
            {course.displayName}
          </H1>
          <H2 className={{ root: 'm-0 text-base' }}>{title}</H2>
        </div>
      )}
      {title && !course?.displayName && (
        <H1 className={{ root: 'mb-0 text-xl' }}>{title}</H1>
      )}
      <div className="text-center">
        <div className="text-sm">
          Level: {participant?.level === undefined ? '0' : participant?.level}
        </div>
        <div className="text-sm">
          XP: {participant?.xp === undefined ? '0' : participant?.xp}
        </div>
      </div>
      <div className="flex flex-row items-center gap-2 sm:gap-4">
        <div className="flex flex-row text-black bg-transparent rounded">
          <Select
            value={router.locale}
            items={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN' },
            ]}
            onChange={(newValue: string) =>
              router.push({ pathname, query }, asPath, {
                locale: newValue,
              })
            }
            className={{
              trigger:
                'text-white border-b border-solid p-0.5 pb-0 rounded-none hover:bg-transparent hover:text-white',
            }}
            basic
          />
        </div>
        {course?.id && (
          <Link href={`/course/${course.id}/docs`}>
            <Button
              className={{
                root: twMerge(
                  'block px-1 md:px-2 py-1 rounded',
                  theme.primaryBgHover,
                  theme.primaryTextHover
                ),
              }}
              basic
            >
              <FontAwesomeIcon className="fa-xl" icon={faCircleQuestion} />
            </Button>
          </Link>
        )}
        {/* <Image src="/bf_icon.svg" width={30} height={30} /> */}
        {participant ? (
          router.pathname !== '/' &&
          (pageInFrame ? (
            <Button
              className={{ root: 'hidden text-white bg-slate-800 md:block' }}
              onClick={() => router.back()}
            >
              {t('shared.generic.back')}
            </Button>
          ) : (
            <Link href="/" legacyBehavior>
              <Button
                className={{ root: 'hidden text-white bg-slate-800 md:block' }}
              >
                {t('shared.generic.home')}
              </Button>
            </Link>
          ))
        ) : (
          <Link href="/login" legacyBehavior>
            <Button className={{ root: 'text-white bg-slate-800' }}>
              {t('shared.generic.login')}
            </Button>
          </Link>
        )}
        {participant && !participant?.avatar && (
          <Link href="/editProfile" legacyBehavior>
            <Button
              className={{
                root: 'hidden text-white bg-uzh-red-100 border-uzh-red-100 md:block',
              }}
            >
              {t('pwa.general.setupProfile')}
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

export default Header
