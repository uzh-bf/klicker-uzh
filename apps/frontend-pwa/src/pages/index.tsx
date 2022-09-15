import { useMutation, useQuery } from '@apollo/client'
import CourseElement from '@components/CourseElement'
import ErrorNotification from '@components/ErrorNotification'
import Layout from '@components/Layout'
import {
  MicroSession,
  ParticipationsDocument,
  Session,
  SubscribeToPushDocument
} from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
import {
  determineInitialSubscriptionState,
  subscribeParticipant,
} from '../utils/push'

const Index = function () {
  const [subscribeToPush] = useMutation(SubscribeToPushDocument)
  const router = useRouter()

  const [pushDisabled, setPushDisabled] = useState<boolean | null >(null)
  const [userInfo, setUserInfo] = useState<string>('')
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  )

  // This is necessary to make sure navigator is defined
  useEffect(() => {
    determineInitialSubscriptionState().then(({ disabled, info, reg, sub }) => {
      setPushDisabled(disabled)
      setUserInfo(info)
      setRegistration(reg)
      setSubscription(sub)
    })
  }, [])

  const { data, loading, error } = useQuery(ParticipationsDocument, {skip: pushDisabled === null, variables: { endpoint: subscription?.endpoint}})

  const {
    courses,
    activeSessions,
    activeMicrolearning,
  }: {
    courses: { id: string; displayName: string }[]
    activeSessions: Session[]
    activeMicrolearning: MicroSession[]
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
            isSubscribed: participation.subscriptions?.length > 0,
          },
        ],
        activeSessions: [
          ...acc.activeSessions,
          ...participation.course?.sessions,
        ],
        activeMicrolearning: [
          ...acc.activeMicrolearning,
          ...participation.course?.microSessions,
        ],
      }
    }, obj)
  }, [data])

  if (!loading && !data) {
    // router.push('/login')
  }
  if (loading || !data) {
    return <div>loading...</div>
  }

  async function onSubscribeClick(
    subscribed: boolean,
    courseId: string
  ) {
    setUserInfo('')
    // Case 1: User unsubscribed
    if (subscribed) {
      // TODO: updateSubscriptionOnServer(subscription, courseId)
      // Case 2: User subscribed
    } else {
      // Case 2a: User already has a push subscription
      if (subscription) {
        console.log(JSON.parse(JSON.stringify(subscription)))
        subscribeToPush({variables: {
          subscriptionObject: JSON.parse(JSON.stringify(subscription)),
          courseId
        }})
        // Case 2b: User has no push subscription yet
      } else {
        try {
          const newSubscription = await subscribeParticipant(
            registration!,
            courseId
          )
          setSubscription(newSubscription)
          subscribeToPush({variables: {
            subscriptionObject: JSON.parse(JSON.stringify(newSubscription)),
            courseId
          }})
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
    <Layout>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="items-start w-full max-w-md p-14">
          <H1>Aktive Sessions</H1>
          <div className="flex flex-col mt-2 mb-8">
            {activeSessions.length === 0 && <div>Keine aktiven Sessions.</div>}
            {activeSessions.map((session) => (
              <Link href={`/session/${session.id}`} key={session.id}>
                <a className="w-full p-3 mt-4 mb-4 mr-4 rounded-md text-l text-start bg-uzh-grey-20 hover:bg-uzh-grey-40">
                  {session.displayName}
                </a>
              </Link>
            ))}
          </div>
          <H1>Verfügbares Microlearning</H1>
          <div className="flex flex-col mt-2 mb-8">
            {activeMicrolearning.length === 0 && (
              <div>Kein aktives Microlearning.</div>
            )}
            {activeMicrolearning.map((micro: any) => (
              <Link href={`/micro/${micro.id}/intro`} key={micro.id}>
                <a className="w-full p-3 mt-4 mb-4 mr-4 text-xl text-center rounded-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
                  {micro.displayName}
                </a>
              </Link>
            ))}
          </div>
          <H1>Kurse</H1>
          <div className="mt-2 mb-8">
            {courses.map((course: any) => (
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
          {userInfo && <ErrorNotification message={userInfo} />}
        </div>
      </div>
    </Layout>
  )
}

export default Index
