import { faBellSlash } from '@fortawesome/free-regular-svg-icons'
import { faBell } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

type courseElementProps = {
  courseName: string
  courseId: string
  disabled: boolean
  isSubscribed: boolean
  onSubscribeClick: (subscribed: boolean, courseId: string) => void
}

const CourseElement = (props: courseElementProps) => {
  // TODO: Fetch initial subscription state from DB

  return (
    <div className="flex justify-between w-full mr-4 align-center hover:cursor-pointer">
      <span className="w-full p-4 text-lg rounded-l-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
        <Link href={`/course/${props.courseId}`}>{props.courseName}</Link>
      </span>
      <span
        className={twMerge(
          'p-3 text-2xl rounded-r-md',
          props.disabled ? 'bg-slate-400' : 'bg-slate-600'
        )}
      >
        <button
          disabled={props.disabled}
          onClick={() =>
            props.onSubscribeClick(props.isSubscribed, props.courseId)
          }
        >
          {props.isSubscribed ? (
            <FontAwesomeIcon
              icon={faBell}
              fixedWidth
              className={twMerge(
                props.disabled
                  ? 'text-uzh-grey-20'
                  : 'text-uzh-yellow-100 hover:text-uzh-grey-20'
              )}
            />
          ) : (
            <FontAwesomeIcon
              icon={faBellSlash}
              fixedWidth
              flip="horizontal"
              className={twMerge(
                props.disabled
                  ? 'text-uzh-grey-20'
                  : 'text-uzh-grey-20 hover:text-uzh-yellow-100'
              )}
            />
          )}
        </button>
      </span>
    </div>
  )
}

export default CourseElement
