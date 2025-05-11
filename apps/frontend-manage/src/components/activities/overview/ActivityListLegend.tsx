import {
  faCheckCircle,
  faClock,
  faPenToSquare,
} from '@fortawesome/free-regular-svg-icons'
import { faFilePen, faPlay, faStamp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function ActivityListLegend({ className }: { className?: string }) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'border-uzh-grey-60 flex flex-row flex-wrap items-center justify-end gap-y-1.5 space-x-5 pb-1.5 text-sm',
        className
      )}
    >
      <div className="flex h-4 flex-row items-center gap-2">
        <FontAwesomeIcon icon={faPenToSquare} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Draft}.statusLabel`)}</div>
      </div>
      <div className="flex h-4 flex-row items-center gap-2 text-orange-600">
        <FontAwesomeIcon icon={faClock} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Scheduled}.statusLabel`)}</div>
      </div>
      <div className="flex h-4 flex-row items-center gap-2 text-green-700">
        <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Published}.statusLabel`)}</div>
      </div>
      <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
        <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Ended}.statusLabel`)}</div>
      </div>
      <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
        <FontAwesomeIcon icon={faStamp} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Graded}.statusLabel`)}</div>
      </div>
      <div className="flex h-4 flex-row items-center gap-2 text-red-700">
        <FontAwesomeIcon icon={faFilePen} className="h-4 w-4" />
        <div>{t(`shared.${PublicationStatus.Template}.statusLabel`)}</div>
      </div>
    </div>
  )
}

export default ActivityListLegend
