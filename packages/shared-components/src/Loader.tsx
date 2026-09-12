import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

function Loader({
  basic,
  data,
}: {
  basic?: boolean
  data?: { cy?: string; test?: string }
}) {
  return (
    <div
      className={twMerge(!basic && 'mx-auto my-auto text-center')}
      data-cy={data?.cy}
      data-test={data?.test}
    >
      <FontAwesomeIcon icon={faSpinner} size="lg" className="animate-spin" />
    </div>
  )
}

export default Loader
