import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

interface AnalyticsNavigationProps {
  hrefLeft: string
  labelLeft: React.ReactNode
  hrefRight: string
  labelRight: React.ReactNode
}

function AnalyticsNavigation({
  hrefLeft,
  labelLeft,
  hrefRight,
  labelRight,
}: AnalyticsNavigationProps) {
  return (
    <div className="flex w-full flex-row justify-between">
      <Link href={hrefLeft} className="mb-6 flex flex-row items-center gap-2">
        <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        <div className="flex flex-row items-center gap-0.5">{labelLeft}</div>
      </Link>
      <Link href={hrefRight} className="mb-6 flex flex-row items-center gap-2">
        <div className="flex flex-row items-center gap-0.5">{labelRight}</div>
        <FontAwesomeIcon icon={faChevronRight} size="lg" />
      </Link>
    </div>
  )
}

export default AnalyticsNavigation
