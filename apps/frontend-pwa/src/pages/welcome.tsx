import { H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import CourseElement from '../../components/CourseElement'
import ErrorNotification from '../../components/ErrorNotification'
import {
  determineInitialSubscriptionState,
  subscribeParticipant,
} from '../utils/push'

const courses = [
  // TODO: fetch actual courses from API
  { courseName: 'Banking und Finance', courseId: 'i38474kfl-394-38jfn' },
  { courseName: 'Statistik I', courseId: 'i3847dfdf-394-3d9gjk' },
  { courseName: 'Corporate Finance', courseId: 'i38sdfsdfl-594-38jfn' },
]

const activeSessions = [
  // TODO: fetch actual courses from API
  { courseName: 'Banking und Finance', courseId: 'i38474kfl-394-38jfn' },
  { courseName: 'Corporate Finance', courseId: 'i38sdfsdfl-594-38jfn' },
]

const microlearning = [
  // TODO: fetch actual courses from API
  { courseName: 'Statistik I', courseId: 'i3847dfdf-394-3d9gjk' },
]

function Welcome() {
  const [pushDisabled, setPushDisabled] = useState<boolean>(true)
  const [userInfo, setUserInfo] = useState<string>('')
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  )

  async function onSubscribeClick(
    subscribed: boolean,
    setSubscribed: Dispatch<SetStateAction<boolean>>,
    courseId: string
  ) {
    // Case 1: User unsubscribed
    if (subscribed) {
      setSubscribed(false)
      // TODO: updateSubscriptionOnServer(subscription, courseId)
      // Case 2: User subscribed
    } else {
      // Case 2a: User already has a push subscription
      if (subscription) {
        // TODO: updateSubscriptionOnServer(subscription, courseId)
        setSubscribed(true)
        // Case 2b: User has no push subscription yet
      } else {
        try {
          const newSubscription = await subscribeParticipant(
            registration!,
            courseId
          )
          // TODO: updateSubscriptionOnServer(newSubscription, courseId)
          setSubscribed(true)
          setSubscription(newSubscription)
        } catch (e) {
          console.error(e)
          if (Notification.permission === 'denied') {
            setSubscribed(false)
            setPushDisabled(true)
            setUserInfo(
              'You have disabled push notifications for this app. If you want to subscribe, enable push notifications in your browser.'
            )
          } else {
            setSubscribed(false)
            setUserInfo(
              'An error occurred while trying to register you for push notifications. Please try again later.'
            )
          }
        }
      }
    }
    return subscription
  }

  // This is necessary to make sure navigator is defined
  useEffect(() => {
    determineInitialSubscriptionState().then(({ disabled, info, reg, sub }) => {
      console.log('subscription:   ', sub)
      console.log('registration:   ', reg)
      setPushDisabled(disabled)
      setUserInfo(info)
      setRegistration(reg)
      setSubscription(sub)
    })
  }, [])

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="items-start w-full max-w-md p-14">
        <H1>Active Sessions</H1>
        <div className="flex flex-col mt-2 mb-8">
          {activeSessions.map((course) => (
            <Link href="https://uzh.ch" key={course.courseId}>
              <a className="w-full p-3 mt-4 mb-4 mr-4 text-center rounded-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
                {course.courseName}
              </a>
            </Link>
          ))}
        </div>
        <H1>Microlearning</H1>
        <div className="flex flex-col mt-2 mb-8">
          {microlearning.map((course) => (
            <Link href="https://uzh.ch" key={course.courseId}>
              <a className="w-full p-3 mt-4 mb-4 mr-4 text-center rounded-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
                {course.courseName}
              </a>
            </Link>
          ))}
        </div>
        <H1>My Courses</H1>
        <div className="mt-2 mb-8">
          {courses.map((course) => (
            <CourseElement
              disabled={pushDisabled}
              key={course.courseId}
              courseId={course.courseId}
              courseName={course.courseName}
              onSubscribeClick={onSubscribeClick}
            />
          ))}
        </div>
        {userInfo && <ErrorNotification message={userInfo} />}
      </div>
    </div>
  )
}

export default Welcome
