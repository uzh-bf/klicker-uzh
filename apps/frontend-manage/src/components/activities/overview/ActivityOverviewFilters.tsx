import { faClock, faSquareCheck } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faFilePen,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import TagHeader from '../../questions/tags/TagHeader'
import TagItem from '../../questions/tags/TagItem'

const STATUS_ICONS = {
  [PublicationStatus.Draft]: [faPencil, faPencil],
  [PublicationStatus.Scheduled]: [faClock, faClock],
  [PublicationStatus.Published]: [faPlay, faPlay],
  [PublicationStatus.Ended]: [faCheck, faCheck],
  [PublicationStatus.Graded]: [faSquareCheck, faSquareCheck],
  [PublicationStatus.Template]: [faFilePen, faFilePen],
}

export type ActivityOverviewFilterType = {
  status: PublicationStatus[]
}

function ActivityOverviewFilters({
  filters,
  setFilters,
}: {
  filters: ActivityOverviewFilterType
  setFilters: Dispatch<SetStateAction<ActivityOverviewFilterType>>
}) {
  const t = useTranslations()
  const [statusVisible, setStatusVisible] = useState(true)

  const toggleStatusFilter = (status: PublicationStatus) => {
    setFilters((prev) => {
      if (prev.status.includes(status)) {
        return {
          ...prev,
          status: prev.status.filter((s) => s !== status),
        }
      }
      return {
        ...prev,
        status: [...prev.status, status],
      }
    })
  }

  return (
    <div className="border-uzh-grey-60 flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-[14rem]">
      <TagHeader
        text={t('shared.generic.status')}
        state={statusVisible}
        setState={setStatusVisible}
      />

      {statusVisible && (
        <ul className="list-none">
          {[
            PublicationStatus.Draft,
            PublicationStatus.Scheduled,
            PublicationStatus.Published,
            PublicationStatus.Ended,
            PublicationStatus.Graded,
            PublicationStatus.Template,
          ].map((status) => (
            <TagItem
              key={status}
              text={t(`shared.${status}.statusLabel`)}
              icon={STATUS_ICONS[status]}
              active={filters.status.includes(status)}
              onClick={() => toggleStatusFilter(status)}
              data={{ cy: `status-filter-${status.toLowerCase()}` }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ActivityOverviewFilters
