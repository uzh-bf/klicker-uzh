import { faBellSlash } from '@fortawesome/free-regular-svg-icons'
import { faBell } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

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

type courseElementProps = {
  courseName: string
  courseId: string
  disabled: boolean
}
const CourseElement = (props: courseElementProps) => {
  // TODO: Fetch initial subscription state from DB
  const [subscribed, setSubscribed] = useState(false)

  const computedClassName = twMerge(
    'p-2 text-2xl rounded-full hover:bg-uzh-yellow-40',
    subscribed
      ? 'bg-uzh-yellow-40 text-yellow-400'
      : 'bg-uzh-yellow-20 text-uzh-yellow-100',
    props.disabled && 'bg-uzh-grey-20 text-uzh-grey-80'
  )

  return (
    <div className="flex justify-between mb-4 text-lg">
      <span>{props.courseName}</span>
      <span>
        <TogglePrimitive.Root
          defaultPressed={subscribed}
          onPressedChange={setSubscribed}
          asChild
        >
          <button disabled={props.disabled}>
            {subscribed ? (
              <FontAwesomeIcon
                icon={faBell}
                fixedWidth
                className={computedClassName}
              />
            ) : (
              <FontAwesomeIcon
                icon={faBellSlash}
                fixedWidth
                flip="horizontal"
                className={computedClassName}
              />
            )}
          </button>
        </TogglePrimitive.Root>
      </span>
    </div>
  )
}

function Welcome() {
  const [pushDisabled, setPushDisabled] = useState(true)

  // This is necessary to make sure navigator is defined
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator)
      setPushDisabled(false)
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Welcome
