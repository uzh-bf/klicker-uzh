import { faCircleXmark } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

type errorNotificationProps = {
  message: string
}

function ErrorNotification(props: errorNotificationProps) {
  return (
    <div className="flex flex-row p-2 mt-4 mb-4 text-sm rounded-md text-uzh-red-100 bg-uzh-red-20">
      <span>
        <FontAwesomeIcon icon={faCircleXmark} className="mr-2" />
      </span>
      <span>{props.message}</span>
    </div>
  )
}

export default ErrorNotification
