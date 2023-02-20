import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Course, Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2, ThemeContext } from '@uzh-bf/design-system'
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
  const t = useTranslations('index')
  const tshared = useTranslations('generic')

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
      <div className="flex flex-row items-center gap-4">
        <div className="flex flex-row text-black bg-transparent rounded">
          <Button
            basic
            onClick={() =>
              router.push({ pathname, query }, asPath, {
                locale: 'de',
              })
            }
            className={{
              root: twMerge(
                'py-1 px-2 rounded-l bg-white',
                router.locale === 'de' &&
                  `font-bold text-white ${theme.primaryBgDark}`
              ),
            }}
          >
            DE
          </Button>
          <Button
            basic
            onClick={() =>
              router.push({ pathname, query }, asPath, {
                locale: 'en',
              })
            }
            className={{
              root: twMerge(
                'py-1 px-2 rounded-r bg-white',
                router.locale === 'en' &&
                  `font-bold text-white ${theme.primaryBgDark}`
              ),
            }}
          >
            EN
          </Button>
        </div>
        {course?.id && (
          <Link href={`/course/${course.id}/docs`}>
            <Button
              className={{
                root: 'bg-slate-800 peer-disabled: md:block border-slate-800',
              }}
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
              {t('back')}
            </Button>
          ) : (
            <Link href="/" legacyBehavior>
              <Button
                className={{ root: 'hidden text-white bg-slate-800 md:block' }}
              >
                {t('home')}
              </Button>
            </Link>
          ))
        ) : (
          <Link href="/login" legacyBehavior>
            <Button className={{ root: 'text-white bg-slate-800' }}>
              {tshared('login')}
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
              {t('setupProfile')}
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
