import { useMutation } from '@apollo/client'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeParticipantLocaleDocument,
  Course,
  LocaleType,
  Participant,
  StudentCourse,
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
  course?:
    | Partial<Course>
    | (Omit<StudentCourse, 'owner'> & { owner: { shortname: string } })
}

function Header({
  participant,
  title,
  course,
}: HeaderProps): React.ReactElement {
  const router = useRouter()
  const { pathname, asPath, query } = router
  const t = useTranslations()

  // const { stickyValue: hasSeenSurvey, setValue: setHasSeenSurvey } =
  //   useStickyState('hasSeenSurvey', 'false')

  const [changeParticipantLocale] = useMutation(ChangeParticipantLocaleDocument)

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <div
      style={{ borderColor: course?.color || undefined }}
      className={twMerge(
        'flex flex-row items-center justify-between border-b-8 bg-slate-800 px-4 py-1 text-white',
        !course?.color && 'border-uzh-red-60'
      )}
    >
      {title && course?.displayName && (
        <div>
          <H1 className={{ root: 'text-uzh-grey-60 m-0 text-xs md:text-sm' }}>
            {course.displayName}
          </H1>
          <H2 className={{ root: 'm-0 text-sm md:text-base' }}>{title}</H2>
        </div>
      )}
      {title && !course?.displayName && (
        <H1 className={{ root: 'mb-0 text-base md:text-lg' }}>{title}</H1>
      )}

      <div className="flex flex-row items-center gap-2 sm:gap-4">
        <div className="flex flex-row rounded bg-transparent text-black">
          <Select
            value={router.locale}
            items={[
              {
                value: LocaleType.De,
                label: 'DE',
                data: { cy: 'language-de' },
              },
              {
                value: LocaleType.En,
                label: 'EN',
                data: { cy: 'language-en' },
              },
            ]}
            onChange={(newValue: string) => {
              changeParticipantLocale({
                variables: { locale: newValue as LocaleType },
              })
              router.push({ pathname, query }, asPath, {
                locale: newValue,
              })
            }}
            className={{
              trigger:
                'rounded-none border-b border-solid p-0.5 pb-0 text-white hover:bg-transparent hover:text-white',
            }}
            data={{ cy: 'language-select' }}
            basic
          />
        </div>
        {/* {hasSeenSurvey === 'false' && (
          <Link
            href="https://qualtricsxm2zqlm4s5q.qualtrics.com/jfe/form/SV_0qyOBbtR0TXnpe6"
            target="_blank"
          >
            <Button
              className={{
                root: 'hidden md:flex text-white flex-row gap-2 items-center bg-uzh-red-100 border-uzh-red-100 rounded px-2 -mx-2',
              }}
              onClick={() => {
                setHasSeenSurvey(true)
              }}
            >
              <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
              <div>{t('shared.generic.survey')}</div>
            </Button>
          </Link>
        )} */}
        {course?.id && (
          <Link href={`/course/${course.id}/docs`}>
            <Button
              className={{
                root: 'hover:bg-primary-20 hover:text-primary-100 block rounded px-1 py-1 md:px-2',
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
              className={{ root: 'hidden bg-slate-800 text-white md:block' }}
              onClick={() => router.back()}
              data={{ cy: 'header-back' }}
            >
              {t('shared.generic.back')}
            </Button>
          ) : (
            <Link href="/">
              <Button
                className={{ root: 'hidden bg-slate-800 text-white md:block' }}
                data={{ cy: 'header-home' }}
              >
                {t('shared.generic.home')}
              </Button>
            </Link>
          ))
        ) : (
          <Link href="/login">
            <Button
              className={{ root: 'bg-slate-800 text-white' }}
              data={{ cy: 'header-login' }}
            >
              {t('shared.generic.login')}
            </Button>
          </Link>
        )}
        {participant && (!participant?.avatar || !participant?.email) && (
          <Link href="/editProfile">
            <Button
              className={{
                root: 'bg-uzh-red-100 border-uzh-red-100 hidden text-white md:block',
              }}
              data={{ cy: 'header-setup-profile' }}
            >
              {t('pwa.general.setupProfile')}
            </Button>
          </Link>
        )}
        <Link href={participant ? '/profile' : '/login'} legacyBehavior>
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
                'hover:bg-uzh-red-20 cursor-pointer rounded-full bg-white',
                participant?.avatar ? '' : 'p-1'
              )}
            />
            {participant?.level && (
              <div
                className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-white text-xs font-bold text-slate-600"
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
