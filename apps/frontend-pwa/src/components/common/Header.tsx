import { useMutation } from '@apollo/client'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeParticipantLocaleDocument,
  Course,
  LocaleType,
  Participant,
  StudentCourse,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithLevel from './AvatarWithLevel'

interface HeaderProps {
  participant?: Partial<Participant>
  title?: string
  course?:
    | Partial<Course>
    | (Omit<StudentCourse, 'owner'> & { owner: { shortname: string } })
  previewMode?: boolean
}

function Header({
  participant,
  title,
  course,
  previewMode = false,
}: HeaderProps): React.ReactElement {
  const router = useRouter()
  const { pathname, asPath, query } = router
  const t = useTranslations()

  // const { stickyValue: hasSeenSurvey, setValue: setHasSeenSurvey } =
  //   useStickyState('hasSeenSurvey', 'false')

  const [changeParticipantLocale, { loading: changingLocale }] = useMutation(
    ChangeParticipantLocaleDocument
  )

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
        {!previewMode ? (
          <div className="flex flex-row rounded bg-transparent text-black">
            <Select
              disabled={changingLocale}
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
                if (participant && participant.role === UserRole.Participant) {
                  changeParticipantLocale({
                    variables: { locale: newValue as LocaleType },
                  })
                }

                router.push({ pathname, query }, asPath, {
                  locale: newValue,
                })
              }}
              className={{
                trigger: 'p-0 px-1 text-white focus:ring-0',
              }}
              data={{ cy: 'language-select' }}
              basic
              contentPosition="popper"
            />
          </div>
        ) : null}
        {course?.id && (
          <Link
            href={`/course/${course.id}/docs`}
            data-cy="course-docs"
            className="flex items-center"
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="h-6 w-6" />
          </Link>
        )}
        {/* <Image src="/bf_icon.svg" width={30} height={30} /> */}
        {participant && participant.role === UserRole.Participant ? (
          router.pathname !== '/' &&
          (pageInFrame ? (
            <Button
              className={{
                root: 'hidden h-8 bg-slate-800 py-0 text-white hover:bg-slate-700 hover:text-white md:block',
              }}
              onClick={() => router.back()}
              data={{ cy: 'header-back' }}
            >
              <Button.Label>{t('shared.generic.back')}</Button.Label>
            </Button>
          ) : (
            <Link href="/">
              <Button
                className={{
                  root: 'hidden h-8 bg-slate-800 py-0 text-white hover:bg-slate-700 hover:text-white md:block',
                }}
                data={{ cy: 'header-home' }}
              >
                <Button.Label>{t('shared.generic.home')}</Button.Label>
              </Button>
            </Link>
          ))
        ) : !previewMode && !participant ? (
          <Link href="/login">
            <Button
              className={{
                root: 'h-8 bg-slate-800 py-0 text-white hover:bg-slate-700 hover:text-white',
              }}
              data={{ cy: 'header-login' }}
            >
              <Button.Label>{t('shared.generic.login')}</Button.Label>
            </Button>
          </Link>
        ) : null}
        {participant &&
          participant.role === UserRole.Participant &&
          (!participant?.avatar || !participant?.email) && (
            <Link href="/editProfile">
              <Button
                primary
                className={{
                  root: 'bg-uzh-red-100 hover:bg-uzh-red-80 h-8 py-0 text-white hover:text-white',
                }}
                data={{ cy: 'header-setup-profile' }}
              >
                <Button.Label>{t('pwa.general.setupProfile')}</Button.Label>
              </Button>
            </Link>
          )}
        {!participant || participant.role === UserRole.Participant ? (
          <Link href={participant ? '/profile' : '/login'} legacyBehavior>
            <AvatarWithLevel
              avatar={participant?.avatar}
              level={participant?.level}
            />
          </Link>
        ) : (
          <AvatarWithLevel
            avatar={participant?.avatar}
            level={participant?.level}
          />
        )}
      </div>
    </div>
  )
}

export default Header
