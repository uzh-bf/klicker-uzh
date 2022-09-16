import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

type UserNotificationProps = {
  message: string
  notificationType: string
  children?: React.ReactNode
}

function UserNotification(props: UserNotificationProps) {
  let notifIcon: any
  let computedClassName: string

  switch (props.notificationType) {
    case 'error':
      computedClassName = 'text-uzh-red-100 bg-uzh-red-20'
      notifIcon = faCircleXmark
      break
    case 'info':
      computedClassName = 'text-uzh-blue-100 bg-uzh-blue-20'
      notifIcon = faCircleInfo
      break
    case 'success':
      computedClassName = 'text-uzh-darkgreen-100 bg-uzh-lightgreen-20'
      notifIcon = faCircleCheck
    default:
      computedClassName = 'text-slate-800 bg-uzh-grey-20'
      notifIcon = faCircleInfo
  }

  return (
    <div
      className={twMerge(
        'flex flex-col p-2 mt-6 mb-4 text-sm rounded-md',
        computedClassName!
      )}
    >
      <div className="flex flex-row">
        <span>
          <FontAwesomeIcon icon={notifIcon!} className="mr-2" />
        </span>
        <span>{props.message}</span>
      </div>
      <div className="flex items-center justify-center mt-2">
        {props.children}
      </div>
    </div>
  )
}

export default UserNotification
