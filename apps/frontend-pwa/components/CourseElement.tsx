import { faBellSlash } from '@fortawesome/free-regular-svg-icons'
import { faBell } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type courseElementProps = {
  courseName: string
  courseId: string
  disabled: boolean
  onSubscribeClick: (
    subscribed: boolean,
    setSubscribed: Dispatch<SetStateAction<boolean>>,
    courseId: string
  ) => void
}

const CourseElement = (props: courseElementProps) => {
  // TODO: Fetch initial subscription state from DB
  const [subscribed, setSubscribed] = useState(false)

  const computedClassNameSubscribed = twMerge(
    'p-2 text-2xl rounded-full',
    props.disabled
      ? 'bg-uzh-grey-20 text-uzh-grey-80 hover:bg-uzh-grey-20'
      : 'bg-uzh-yellow-40 text-yellow-400 hover:text-uzh-yellow-100'
  )

  const computedClassNameNotSubscribed = twMerge(
    'p-2 text-2xl rounded-full',
    props.disabled
      ? 'bg-uzh-grey-20 text-uzh-grey-80 hover:bg-uzh-grey-20'
      : 'bg-uzh-yellow-20 text-uzh-yellow-100 hover:bg-uzh-yellow-40'
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
          <button
            disabled={props.disabled}
            onClick={() =>
              props.onSubscribeClick(subscribed, setSubscribed, props.courseId)
            }
          >
            {subscribed ? (
              <FontAwesomeIcon
                icon={faBell}
                fixedWidth
                className={computedClassNameSubscribed}
              />
            ) : (
              <FontAwesomeIcon
                icon={faBellSlash}
                fixedWidth
                flip="horizontal"
                className={computedClassNameNotSubscribed}
              />
            )}
          </button>
        </TogglePrimitive.Root>
      </span>
    </div>
  )
}

export default CourseElement
