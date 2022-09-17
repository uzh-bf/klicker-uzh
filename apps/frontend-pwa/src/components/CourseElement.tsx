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

const CourseElement = ({
  courseId,
  courseName,
  isSubscribed,
  disabled,
  onSubscribeClick,
}: courseElementProps) => {
  // TODO: Fetch initial subscription state from DB

  return (
    <div className="flex justify-between w-full mr-4 align-center hover:cursor-pointer">
      <Link href={`/course/${courseId}`}>
        <span className="w-full p-4 text-lg rounded-l-md bg-uzh-grey-20 hover:bg-uzh-grey-40">
          {courseName}
        </span>
      </Link>

      <button
        className={twMerge(
          'py-2 px-4 text-2xl rounded-r-md',
          disabled ? 'bg-slate-400' : 'bg-slate-600',
          !isSubscribed && !disabled && 'cursor-pointer hover:text-white'
        )}
        disabled={isSubscribed || disabled}
        onClick={() => onSubscribeClick(isSubscribed, courseId)}
      >
        {isSubscribed ? (
          <FontAwesomeIcon
            className="text-uzh-yellow-100"
            icon={faBell}
            fixedWidth
          />
        ) : (
          <FontAwesomeIcon icon={faBellSlash} fixedWidth flip="horizontal" />
        )}
      </button>
    </div>
  )
}

export default CourseElement
