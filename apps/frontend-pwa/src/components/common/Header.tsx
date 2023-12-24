import { useMutation } from '@apollo/client'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeParticipantLocaleDocument,
  Course,
  Participant,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
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
  const t = useTranslations()

  const [changeParticipantLocale] = useMutation(ChangeParticipantLocaleDocument)

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <div
      style={{ borderColor: course?.color || undefined }}
      className={twMerge(
        'flex flex-row items-center justify-between px-4 text-white bg-slate-800 border-b-8 py-1',
        !course?.color && 'border-uzh-red-60'
      )}
    >
      {title && course?.displayName && (
        <div>
          <H1 className={{ root: 'm-0 text-xs md:text-sm text-uzh-grey-60' }}>
            {course.displayName}
          </H1>
          <H2 className={{ root: 'm-0 text-sm md:text-base' }}>{title}</H2>
        </div>
      )}
      {title && !course?.displayName && (
        <H1 className={{ root: 'mb-0 text-base md:text-lg' }}>{title}</H1>
      )}

      <div className="flex flex-row items-center gap-2 sm:gap-4">
        <div className="flex flex-row text-black bg-transparent rounded">
          <Select
            value={router.locale}
            items={[
              { value: 'de', label: 'DE', data: { cy: 'language-de' } },
              { value: 'en', label: 'EN', data: { cy: 'language-en' } },
            ]}
            onChange={(newValue: string) => {
              changeParticipantLocale({ variables: { locale: newValue } })
              router.push({ pathname, query }, asPath, {
                locale: newValue,
              })
            }}
            className={{
              trigger:
                'text-white border-b border-solid p-0.5 pb-0 rounded-none sm:hover:bg-transparent sm:hover:text-white',
            }}
            data={{ cy: 'language-select' }}
            basic
          />
        </div>
        {course?.id && (
          <Link href={`/course/${course.id}/docs`}>
            <Button
              className={{
                root: 'block px-1 md:px-2 py-1 rounded hover:bg-primary-20 sm:hover:text-primary',
              }}
              basic
              data={{ cy: 'course-docs' }}
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
              data={{ cy: 'header-back' }}
            >
              {t('shared.generic.back')}
            </Button>
          ) : (
            <Link href="/">
              <Button
                className={{ root: 'hidden text-white bg-slate-800 md:block' }}
                data={{ cy: 'header-home' }}
              >
                {t('shared.generic.home')}
              </Button>
            </Link>
          ))
        ) : (
          <Link href="/login">
            <Button
              className={{ root: 'text-white bg-slate-800' }}
              data={{ cy: 'header-login' }}
            >
              {t('shared.generic.login')}
            </Button>
          </Link>
        )}
        {participant && !participant?.avatar && (
          <Link href="/editProfile">
            <Button
              className={{
                root: 'hidden text-white bg-uzh-red-100 border-uzh-red-100 md:block',
              }}
              data={{ cy: 'header-setup-profile' }}
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
          <Button
            basic
            className={{ root: 'relative' }}
            data={{ cy: 'header-avatar' }}
          >
            <Image
              src={
                participant?.avatar
                  ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${participant?.avatar}.svg`
                  : '/user-solid.svg'
              }
              alt=""
              width="35"
              height="35"
              className={twMerge(
                'bg-white cursor-pointer rounded-full sm:hover:bg-uzh-red-20',
                participant?.avatar ? '' : 'p-1'
              )}
            />
            {participant?.level && (
              <div
                className="absolute bottom-0 right-0 w-4 h-4 text-xs font-bold bg-white rounded-full text-slate-600"
                data-cy="participant-level"
              >
                {participant.level}
              </div>
            )}
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default Header
