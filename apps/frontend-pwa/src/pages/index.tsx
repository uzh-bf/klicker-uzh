import { useMutation, useQuery } from '@apollo/client'
import CourseElement from '@components/CourseElement'
import Layout from '@components/Layout'
import UserNotification from '@components/UserNotification'
import {
  faBookOpenReader,
  faChalkboard,
  faCheck,
  faLink,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MicroSession,
  ParticipationsDocument,
  Session,
  SubscribeToPushDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  determineInitialSubscriptionState,
  subscribeParticipant,
} from '../utils/push'

const Index = function () {
  const router = useRouter()

  const [pushDisabled, setPushDisabled] = useState<boolean | null>(null)
  const [userInfo, setUserInfo] = useState<string>('')
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  )

  const { data, loading, error } = useQuery(ParticipationsDocument, {
    skip: pushDisabled === null,
    variables: { endpoint: subscription?.endpoint },
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
    activeSessions,
    activeMicrolearning,
  }: {
    courses: { id: string; displayName: string; isSubscribed: boolean }[]
    activeSessions: (Session & { courseName: string })[]
    activeMicrolearning: (MicroSession & {
      courseName: string
      isCompleted: boolean
    })[]
  } = useMemo(() => {
    const obj = { courses: [], activeSessions: [], activeMicrolearning: [] }
    if (!data?.participations) return obj
    return data.participations.reduce((acc, participation) => {
      return {
        courses: [
          ...acc.courses,
          {
            id: participation.course.id,
            displayName: participation.course.displayName,
            isSubscribed:
              participation.subscriptions &&
              participation.subscriptions.length > 0,
          },
        ],
        activeSessions: [
          ...acc.activeSessions,
          ...participation.course.sessions?.map((session) => ({
            ...session,
            courseName: participation.course.displayName,
          })),
        ],
        activeMicrolearning: [
          ...acc.activeMicrolearning,
          ...participation.course?.microSessions.map((session) => ({
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
    <Layout courseName="KlickerUZH" displayName="Kursübersicht">
      <div className="flex flex-col md:w-full md:max-w-xl md:p-8 md:m-auto md:border md:rounded">
        <H1 className="text-xl">Aktive Sessions ({activeSessions.length})</H1>
        <div className="flex flex-col gap-2 mt-2 mb-8">
          {activeSessions.length === 0 && <div>Keine aktiven Sessions.</div>}
          {activeSessions.map((session) => (
            <Link
              href={session.linkTo || `/session/${session.id}`}
              key={session.id}
            >
              <Button className="gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40">
                <Button.Icon>
                  <FontAwesomeIcon
                    icon={session.linkTo ? faLink : faChalkboard}
                  />
                </Button.Icon>
                <Button.Label className="flex-1">
                  <div className="flex flex-col items-center justify-between md:flex-row">
                    <div>{session.displayName}</div>
                    <div className="text-sm">{session.courseName}</div>
                  </div>
                </Button.Label>
              </Button>
            </Link>
          ))}
        </div>

        <H1 className="text-xl">
          Aktives Microlearning ({activeMicrolearning.length})
        </H1>
        <div className="flex flex-col gap-2 mt-2 mb-8">
          {activeMicrolearning.length === 0 && (
            <div>Kein aktives Microlearning.</div>
          )}
          {activeMicrolearning.map((micro) => (
            <Link href={`/micro/${micro.id}/`} key={micro.id}>
              <Button
                disabled={micro.isCompleted}
                className={twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40',
                  micro.isCompleted && 'hover:bg-unset'
                )}
              >
                <Button.Icon>
                  <FontAwesomeIcon
                    icon={micro.isCompleted ? faCheck : faBookOpenReader}
                  />
                </Button.Icon>
                <Button.Label className="flex-1 text-left">
                  <div>{micro.displayName}</div>
                  <div className="flex flex-row items-end justify-between">
                    <div className="text-xs">
                      {dayjs(micro.scheduledStartAt).format('D.M.YYYY HH:mm')} -{' '}
                      {dayjs(micro.scheduledEndAt).format('D.M.YYYY HH:mm')}
                    </div>
                    <div className="text-xs">{micro.courseName}</div>
                  </div>
                </Button.Label>
              </Button>
            </Link>
          ))}
        </div>

        <H1 className="text-xl">Meine Kurse ({courses.length})</H1>
        <div className="flex flex-col gap-2 mt-2">
          {courses.length === 0 && <div>Keine Kursmitgliedschaften.</div>}
          {courses.map((course) => (
            <CourseElement
              disabled={!!pushDisabled}
              key={course.id}
              courseId={course.id}
              courseName={course.displayName}
              onSubscribeClick={onSubscribeClick}
              isSubscribed={course.isSubscribed}
            />
          ))}
        </div>

        {userInfo && (
          <UserNotification notificationType="info" message={userInfo} />
        )}
      </div>
    </Layout>
  )
}

export default Index
