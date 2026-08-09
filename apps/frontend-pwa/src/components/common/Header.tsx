import { useMutation, useQuery } from '@apollo/client'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import {
  faExclamationCircle,
  faLanguage,
  faRightFromBracket,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeParticipantLocaleDocument,
  Course,
  GetCourseChatbotsDocument,
  LocaleType,
  LogoutParticipantDocument,
  LogoutTemporaryParticipantDocument,
  Participant,
  SelfDocument,
  StudentCourse,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown, H1, H2, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
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
  liveQuizId?: string
}

function Header({
  participant,
  title,
  course,
  liveQuizId,
}: HeaderProps): React.ReactElement {
  const router = useRouter()
  const { pathname, asPath, query } = router
  const t = useTranslations()

  const [changeParticipantLocale, { loading: changingLocale }] = useMutation(
    ChangeParticipantLocaleDocument
  )
  const [logoutParticipant, { loading: loggingOut }] = useMutation(
    LogoutParticipantDocument
  )
  const [logoutTemporaryParticipant, { loading: loggingOutTemporary }] =
    useMutation(LogoutTemporaryParticipantDocument)

  const courseId = course?.id
  const { data: chatbotData } = useQuery(GetCourseChatbotsDocument, {
    variables: courseId ? { courseId } : undefined,
    skip:
      !courseId ||
      participant?.role !== UserRole.Participant ||
      process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
  })
  // courses are limited to a single chatbot for now, so the header links the
  // first one and does not build a multi-chatbot affordance
  const courseChatbot = chatbotData?.courseChatbots?.[0]

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location
  const showProfileSetup =
    participant &&
    participant.role === UserRole.Participant &&
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
    (!participant?.avatar || !participant?.email)

  return (
    <div
      style={{ borderColor: course?.color || undefined }}
      className={twMerge(
        'flex flex-row items-center justify-between border-b-8 bg-slate-700 py-1.5 pl-2 pr-2 text-white md:py-1',
        !course?.color && 'border-uzh-red-60'
      )}
    >
      <div className="flex max-w-[calc(100%-2.5rem)] flex-row items-center gap-3">
        <Image
          priority
          src="/klicker-icon-inverted.png"
          alt="KlickerUZH Logo"
          width={35}
          height={35}
          onClick={() => router.push('/')}
          className="cursor-pointer"
        />

        {title && course?.displayName && (
          <div>
            <H1
              className={{
                root: 'text-uzh-grey-60 m-0 line-clamp-1 text-xs md:text-sm',
              }}
              data={{ cy: 'header-course-display-name' }}
            >
              {course.displayName}
            </H1>
            <H2
              className={{
                root: 'm-0 line-clamp-1 text-sm md:text-base',
              }}
              data={{ cy: 'header-page-title' }}
            >
              {title}
            </H2>
          </div>
        )}
        {title && !course?.displayName && (
          <H1 className={{ root: 'mb-0 line-clamp-1 text-base md:text-lg' }}>
            {title}
          </H1>
        )}
      </div>

      <div className="flex flex-row items-center gap-2 sm:gap-4">
        {participant &&
          participant.role === UserRole.Participant &&
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
          ))}

        {courseId && courseChatbot && (
          <Link
            href={`/course/${courseId}/chatbot/${courseChatbot.id}`}
            target="_blank"
            rel="noopener"
          >
            <Button
              primary
              className={{
                root: 'h-8 bg-slate-800 py-0 text-white hover:bg-slate-700 hover:text-white',
              }}
              data={{ cy: 'student-course-chatbot-link' }}
            >
              <Button.Label>{t('pwa.chatbot.openCourseChat')}</Button.Label>
            </Button>
          </Link>
        )}

        <Dropdown
          trigger={
            <>
              <AvatarWithLevel
                avatar={participant?.avatar}
                level={
                  process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true'
                    ? participant?.level
                    : undefined
                }
              />
              {showProfileSetup && (
                <FontAwesomeIcon
                  icon={faExclamationCircle}
                  className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-orange-500"
                />
              )}
            </>
          }
          items={[
            ...(participant
              ? [
                  {
                    id: 'loggedInAs',
                    type: 'label' as 'label',
                    label: (
                      <div className="font-bold">
                        <div>{t('pwa.profile.loggedInAs')}</div>
                        <div className="font-normal">
                          {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
                            ? (participant.institutionalEmail ??
                              participant.email)
                            : `${participant?.username}${participant.role === UserRole.TemporaryParticipant ? ` (${t('pwa.profile.temporaryPseudonym')})` : ''}`}
                        </div>
                      </div>
                    ),
                    className: { item: 'h-max! py-0.5' },
                    data: { cy: 'header-logged-in-as' },
                  },
                  {
                    id: 'separator',
                    type: 'separator' as 'separator',
                    className: { item: 'h-1.5!' },
                  },
                ]
              : []),
            ...(showProfileSetup
              ? [
                  {
                    id: 'setupProfile',
                    type: 'standard' as 'standard',
                    label: (
                      <div>
                        <FontAwesomeIcon
                          icon={faExclamationCircle}
                          className="mr-2 w-4 text-orange-500"
                        />
                        <span className="text-orange-500">
                          {t('pwa.general.setupProfile')}
                        </span>
                      </div>
                    ),
                    onClick: () => router.push('/editProfile'),
                    data: { cy: 'header-setup-profile' },
                  },
                ]
              : []),
            ...((!router.pathname.includes('/session') ||
              participant?.role !== UserRole.TemporaryParticipant) &&
            process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
            (participant || !pageInFrame)
              ? [
                  {
                    id: 'profileOrLogin',
                    type: 'standard' as 'standard',
                    label: (
                      <div>
                        <FontAwesomeIcon icon={faUser} className="mr-2 w-4" />
                        <span>
                          {participant
                            ? t('shared.generic.profile')
                            : t('shared.generic.login')}
                        </span>
                      </div>
                    ),
                    onClick: () => {
                      if (participant) {
                        router.push('/profile')
                      } else {
                        router.push('/login')
                      }
                    },
                    data: { cy: 'participant-profile-login' },
                  },
                ]
              : []),
            {
              id: 'docs',
              type: 'standard' as 'standard',
              label: (
                <div>
                  <FontAwesomeIcon
                    icon={faCircleQuestion}
                    className="mr-2 w-4"
                  />
                  <span>{t('shared.generic.documentation')}</span>
                </div>
              ),
              onClick: () => router.push(`/docs`),
              data: { cy: 'course-docs' },
            },
            {
              id: 'languageSwitch',
              label: (
                <div>
                  <FontAwesomeIcon icon={faLanguage} className="mr-2 w-4" />
                  <span>{t('shared.generic.language')}</span>
                </div>
              ),
              type: 'submenu',
              data: { cy: 'language-switch' },
              items: [
                {
                  id: 'languageDE',
                  value: LocaleType.De,
                  flag: '🇩🇪',
                  label: t('shared.generic.de'),
                },
                {
                  id: 'languageEN',
                  value: LocaleType.En,
                  flag: '🇬🇧',
                  label: t('shared.generic.en'),
                },
              ].map((language) => ({
                id: language.id,
                disabled: changingLocale,
                label: (
                  <>
                    <span className="mr-1 md:mr-2">{language.flag}</span>
                    <span>{language.label}</span>
                  </>
                ),
                type: 'checkbox',
                onClick: async () => {
                  if (
                    participant &&
                    participant.role === UserRole.Participant
                  ) {
                    await changeParticipantLocale({
                      variables: { locale: language.value },
                    })
                  }

                  router.push({ pathname, query }, asPath, {
                    locale: language.value,
                  })
                },
                selected: router.locale === language.value,
              })),
            },
            ...(participant?.role === UserRole.Participant && !pageInFrame
              ? [
                  {
                    id: 'logout',
                    type: 'standard' as 'standard',
                    disabled: loggingOut,
                    label: (
                      <div className="text-red-600">
                        <FontAwesomeIcon
                          icon={faRightFromBracket}
                          className="mr-2 w-4"
                        />
                        <span>{t('shared.generic.logout')}</span>
                      </div>
                    ),
                    onClick: async () => {
                      await logoutParticipant()
                      router.push('/login')
                    },
                    data: { cy: 'logout' },
                  },
                ]
              : []),
            ...(participant?.role === UserRole.TemporaryParticipant &&
            liveQuizId
              ? [
                  {
                    id: 'logout',
                    type: 'standard' as 'standard',
                    disabled: loggingOutTemporary,
                    label: (
                      <div className="text-red-600">
                        <FontAwesomeIcon
                          icon={faRightFromBracket}
                          className="mr-2 w-4"
                        />
                        <span>{t('shared.generic.logout')}</span>
                      </div>
                    ),
                    onClick: async () => {
                      try {
                        // log out temporary participant for this live quiz
                        const { data } = await logoutTemporaryParticipant({
                          variables: { liveQuizId },
                          refetchQueries: [
                            { query: SelfDocument, variables: { liveQuizId } },
                          ],
                        })

                        if (data?.logoutTemporaryParticipant) {
                          // remove local storage entry for temporary participant
                          localStorage.removeItem(`login-state-${liveQuizId}`)

                          router.reload()
                        } else {
                          toast({
                            type: 'error',
                            message: t(
                              'pwa.profile.errorLogoutTemporaryParticipant'
                            ),
                          })
                        }
                      } catch (e) {
                        console.error(
                          'Error logging out temporary participant:',
                          e
                        )
                        toast({
                          type: 'error',
                          message: t(
                            'pwa.profile.errorLogoutTemporaryParticipant'
                          ),
                        })
                      }
                    },
                    data: { cy: 'logout' },
                  },
                ]
              : []),
          ]}
          className={{
            item: 'h-8 text-sm md:h-8 md:text-base',
            trigger:
              'p-0! relative my-1 border-none bg-transparent hover:bg-transparent',
          }}
          data={{ cy: 'header-avatar' }}
        />
      </div>
    </div>
  )
}

export default Header
