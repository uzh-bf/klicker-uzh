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
    props.disabled
      ? 'text-uzh-grey-20'
      : 'text-uzh-yellow-100 hover:text-uzh-grey-20'
  )

  const computedClassNameNotSubscribed = twMerge(
    props.disabled
      ? 'text-uzh-grey-20'
      : 'text-uzh-grey-20 hover:text-uzh-yellow-100'
  )

  const computedClassNameButton = twMerge(
    'h-full p-3 text-2xl rounded-r-md',
    props.disabled ? 'bg-slate-400' : 'bg-slate-600'
  )

  return (
    <div className="flex justify-between w-full mt-4 mb-4 mr-4align-center">
      <span className="w-full p-4 text-l text-start rounded-l-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
        {/* TODO: ev. turn into link */}
        {props.courseName}
      </span>
      <span className={computedClassNameButton}>
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
