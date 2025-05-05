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

  return (
    <div className="border-uzh-grey-60 flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-[14rem]">
      <TagHeader
        text={t('shared.generic.status')}
        state={statusVisible}
        setState={setStatusVisible}
      />

      {statusVisible && (
        <ul className="list-none">
          <TagItem
            key="Draft"
            text={t(`shared.${PublicationStatus.Draft}.statusLabel`)}
            icon={[faPencil, faPencil]}
            active={filters.status.includes(PublicationStatus.Draft)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Draft)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Draft
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Draft],
                }
              })
            }}
            data={{ cy: 'status-filter-draft' }}
          />
          <TagItem
            key="Scheduled"
            text={t(`shared.${PublicationStatus.Scheduled}.statusLabel`)}
            icon={[faClock, faClock]}
            active={filters.status.includes(PublicationStatus.Scheduled)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Scheduled)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Scheduled
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Scheduled],
                }
              })
            }}
            data={{ cy: 'status-filter-scheduled' }}
          />
          <TagItem
            key="Published"
            text={t(`shared.${PublicationStatus.Published}.statusLabel`)}
            icon={[faPlay, faPlay]}
            active={filters.status.includes(PublicationStatus.Published)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Published)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Published
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Published],
                }
              })
            }}
            data={{ cy: 'status-filter-published' }}
          />
          <TagItem
            key="Ended"
            text={t(`shared.${PublicationStatus.Ended}.statusLabel`)}
            icon={[faCheck, faCheck]}
            active={filters.status.includes(PublicationStatus.Ended)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Ended)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Ended
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Ended],
                }
              })
            }}
            data={{ cy: 'status-filter-ended' }}
          />
          <TagItem
            key="Graded"
            text={t(`shared.${PublicationStatus.Graded}.statusLabel`)}
            icon={[faSquareCheck, faSquareCheck]}
            active={filters.status.includes(PublicationStatus.Graded)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Graded)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Graded
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Graded],
                }
              })
            }}
            data={{ cy: 'status-filter-graded' }}
          />
          <TagItem
            key="Template"
            text={t(`shared.${PublicationStatus.Template}.statusLabel`)}
            icon={[faFilePen, faFilePen]}
            active={filters.status.includes(PublicationStatus.Template)}
            onClick={(): void => {
              setFilters((prev) => {
                if (prev.status.includes(PublicationStatus.Template)) {
                  return {
                    ...prev,
                    status: prev.status.filter(
                      (status) => status !== PublicationStatus.Template
                    ),
                  }
                }
                return {
                  ...prev,
                  status: [...prev.status, PublicationStatus.Template],
                }
              })
            }}
            data={{ cy: 'status-filter-template' }}
          />
        </ul>
      )}
    </div>
  )
}

export default ActivityOverviewFilters
