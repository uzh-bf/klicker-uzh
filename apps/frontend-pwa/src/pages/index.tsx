import { useMutation, useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import {
  faBookOpenReader,
  faChalkboard,
  faCheck,
  faCirclePlus,
  faGraduationCap,
  faLink,
} from '@fortawesome/free-solid-svg-icons'
import {
  MicroSession,
  ParticipationsDocument,
  Session,
  SubscribeToPushDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import LinkButton from '../components/common/LinkButton'
import CourseElement from '../components/CourseElement'
import Layout from '../components/Layout'
import {
  determineInitialSubscriptionState,
  subscribeParticipant,
} from '../utils/push'

const Index = function () {
  const t = useTranslations()
  const [pushDisabled, setPushDisabled] = useState<boolean | null>(null)
  const [userInfo, setUserInfo] = useState<string>('')
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  )

  const { data, loading, error } = useQuery(ParticipationsDocument, {
    variables: { endpoint: subscription?.endpoint },
    fetchPolicy: 'network-only',
  })

  // This is necessary to make sure navigator is defined
  useEffect(() => {
    determineInitialSubscriptionState().then(({ disabled, info, reg, sub }) => {
      setPushDisabled(disabled)
      setUserInfo(info)
      setRegistration(reg)
      setSubscription(sub)
    })
  }, [])

  const [subscribeToPush] = useMutation(SubscribeToPushDocument)

  const {
    courses,
    oldCourses,
    activeSessions,
    activeMicrolearning,
  }: {
    courses: {
      id: string
      displayName: string
      isSubscribed: boolean
      startDate: string
      endDate: string
      isGamificationEnabled: boolean
    }[]
    oldCourses: {
      id: string
      displayName: string
      isSubscribed: boolean
      startDate: string
      endDate: string
    }[]
    activeSessions: (Session & { courseName: string })[]
    activeMicrolearning: (MicroSession & {
      courseName: string
      isCompleted: boolean
    })[]
  } = useMemo(() => {
    const obj = {
      courses: [],
      oldCourses: [],
      activeSessions: [],
      activeMicrolearning: [],
    }
    if (!data?.participations) return obj
    return data.participations.reduce((acc, participation) => {
      return {
        courses:
          // check if endDate of course is before today or today
          dayjs(participation.course?.endDate).isAfter(dayjs()) ||
          dayjs(participation.course?.endDate).isSame(dayjs())
            ? [
                ...acc.courses,
                {
                  id: participation.course?.id,
                  displayName: participation.course?.displayName,
                  startDate: participation.course?.startDate,
                  endDate: participation.course?.endDate,
                  isGamificationEnabled:
                    participation.course?.isGamificationEnabled,
                  isSubscribed:
                    participation.subscriptions &&
                    participation.subscriptions.length > 0,
                },
              ]
            : acc.courses,
        oldCourses: dayjs(participation.course?.endDate).isBefore(dayjs())
          ? [
              ...acc.oldCourses,
              {
                id: participation.course?.id,
                displayName: participation.course?.displayName,
                startDate: participation.course?.startDate,
                endDate: participation.course?.endDate,
                isSubscribed:
                  participation.subscriptions &&
                  participation.subscriptions.length > 0,
              },
            ]
          : acc.oldCourses,
        activeSessions: [
          ...acc.activeSessions,
          ...participation.course.sessions?.map((session) => ({
            ...session,
            courseName: participation.course.displayName,
          })),
        ],
        activeMicrolearning: [
          ...acc.activeMicrolearning,
          ...participation.course?.microSessions?.map((session) => ({
            ...session,
            courseName: participation.course.displayName,
            isCompleted: participation.completedMicroSessions?.includes(
              session.id
            ),
          })),
        ],
      }
    }, obj)
  }, [data])

  if (loading || !data) {
    return <div>loading...</div>
  }

  async function onSubscribeClick(subscribed: boolean, courseId: string) {
    setUserInfo('')
    // Case 1: User unsubscribed
    if (subscribed) {
      // TODO: updateSubscriptionOnServer(subscription, courseId)
      // Case 2: User subscribed
    } else {
      // Case 2a: User already has a push subscription
      if (subscription) {
        subscribeToPush({
          variables: {
            subscriptionObject: subscription,
            courseId,
          },
        })
        // Case 2b: User has no push subscription yet
      } else {
        try {
          const newSubscription = await subscribeParticipant(
            registration!,
            courseId
          )
          setSubscription(newSubscription)
          subscribeToPush({
            variables: {
              subscriptionObject: newSubscription,
              courseId,
            },
          })
        } catch (e) {
          console.error(e)
          // Push notifications are disabled
          if (Notification.permission === 'denied') {
            setPushDisabled(true)
            setUserInfo(
              `Sie haben Push-Benachrichtigungen für diese Applikation deaktiviert. Wenn Sie Push-Benachrichtigungen
              abonnieren möchten, aktivieren Sie diese in Ihrem Browser und laden Sie die Seite neu.`
            )
            // User has clicked away the prompt without allowing nor blocking
          } else if (
            e instanceof DOMException &&
            e.name === 'NotAllowedError'
          ) {
            setUserInfo(
              'Bitte erlauben Sie Push-Benachrichtigungen für diese Applikation in Ihrem Browser.'
            )
            // An error occured
          } else {
            setUserInfo(
              'Beim Versuch, Sie für Push-Benachrichtigungen zu registrieren, ist ein Fehler aufgetreten. Bitte versuchen Sie es später noch einmal.'
            )
          }
        }
      }
    }
    return subscription
  }

  return (
    <Layout displayName={t('shared.generic.title')}>
      <div
        className="flex flex-col gap-4 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded"
        data-cy="homepage"
      >
        {activeSessions.length !== 0 && (
          <div>
            <H1 className={{ root: 'text-xl mb-2' }}>
              {t('shared.generic.activeSessions')}
            </H1>
            <div className="flex flex-col gap-2">
              {activeSessions.map((session) => (
                <LinkButton
                  href={session.linkTo || `/session/${session.id}`}
                  key={session.id}
                  icon={session.linkTo ? faLink : faChalkboard}
                >
                  <div className="flex flex-row items-end justify-between md:flex-row">
                    <div>{session.displayName}</div>
                    <div className="text-sm">{session.courseName}</div>
                  </div>
                </LinkButton>
              ))}
            </div>
          </div>
        )}
        <div>
          <H1 className={{ root: 'text-xl mb-2' }}>
            {t('shared.generic.learningElements')}
          </H1>
          <div className="flex flex-col gap-2">
            <LinkButton href="/repetition" icon={faGraduationCap}>
              {t('shared.generic.repetition')}
            </LinkButton>
            <LinkButton href="/bookmarks" icon={faBookmark}>
              {t('pwa.general.myBookmarks')}
            </LinkButton>
          </div>
        </div>
        {activeMicrolearning.length > 0 && (
          <div data-cy="micro-learnings">
            <H1 className={{ root: 'text-xl mb-2' }}>
              {t('shared.generic.microlearning')}
            </H1>
            <div className="flex flex-col gap-2">
              {activeMicrolearning.map((micro) => (
                <LinkButton
                  icon={micro.isCompleted ? faCheck : faBookOpenReader}
                  href={micro.isCompleted ? '' : `/micro/${micro.id}/`}
                  key={micro.id}
                  disabled={micro.isCompleted}
                  className={{
                    root:
                      micro.isCompleted && 'hover:bg-unset cursor-not-allowed',
                  }}
                >
                  <div>{micro.displayName}</div>
                  <div className="flex flex-row items-end justify-between">
                    <div className="text-xs">
                      {dayjs(micro.scheduledStartAt).format('DD.MM.YYYY HH:mm')}{' '}
                      - {dayjs(micro.scheduledEndAt).format('DD.MM.YYYY HH:mm')}
                    </div>
                    <div className="text-xs">{micro.courseName}</div>
                  </div>
                </LinkButton>
              ))}
            </div>
          </div>
        )}
        <div>
          <H1 className={{ root: 'text-xl mb-2' }}>
            {t('pwa.general.myCourses')}
          </H1>
          <div className="flex flex-col gap-2">
            {courses.map((course) => (
              <CourseElement
                disabled={
                  !course?.isGamificationEnabled && !course?.description
                }
                key={course.id}
                course={course}
                onSubscribeClick={onSubscribeClick}
              />
            ))}
            {oldCourses.map((course) => (
              <CourseElement key={course.id} course={course} />
            ))}
            <LinkButton icon={faCirclePlus} href="/join">
              {t('pwa.general.joinCourse')}
            </LinkButton>
          </div>
        </div>
        {userInfo && (
          <UserNotification notificationType="info" message={userInfo} />
        )}
        {/* <SurveyPromotion courseId={courses?.[0]?.id} /> */}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Index
