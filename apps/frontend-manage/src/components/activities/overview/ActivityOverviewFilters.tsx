import {
  faCheckCircle as faCheckCircleRegular,
  faClock as faClockRegular,
  faPenToSquare as faPenToSquareRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCheckCircle as faCheckCircleSolid,
  faClock as faClockSolid,
  faFilePen,
  faGraduationCap,
  faListCheck,
  faPenToSquare as faPenToSquareSolid,
  faPlay,
  faQuestionCircle,
  faStamp,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  PublicationStatus,
  SharingType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import TagHeader from '../../questions/tags/TagHeader'
import TagItem from '../../questions/tags/TagItem'
import { SHARING_TYPE_FILTERS } from '../../questions/tags/TagList'

const STATUS_ICONS = {
  [PublicationStatus.Draft]: [faPenToSquareRegular, faPenToSquareSolid],
  [PublicationStatus.Scheduled]: [faClockRegular, faClockSolid],
  [PublicationStatus.Published]: [faPlay, faPlay],
  [PublicationStatus.Ended]: [faCheckCircleRegular, faCheckCircleSolid],
  [PublicationStatus.Graded]: [faStamp, faStamp],
  [PublicationStatus.Template]: [faFilePen, faFilePen],
}

const TYPE_ICONS = {
  [ActivityType.LiveQuiz]: [faQuestionCircle, faQuestionCircle],
  [ActivityType.PracticeQuiz]: [faListCheck, faListCheck],
  [ActivityType.MicroLearning]: [faGraduationCap, faGraduationCap],
  [ActivityType.GroupActivity]: [faUserGroup, faUserGroup],
}

export type ActivityOverviewFilterType = {
  status: PublicationStatus[]
  sharingType?: SharingType[]
  type?: ActivityType
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
  const [sharingTypeVisible, setSharingTypeVisible] = useState(true)
  const [typesVisible, setTypesVisible] = useState(true)

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

  const toggleSharingTypeFilter = (type: SharingType) => {
    setFilters((prev) => {
      if (prev.sharingType?.includes(type)) {
        return {
          ...prev,
          sharingType: prev.sharingType.filter((s) => s !== type),
        }
      }
      return {
        ...prev,
        sharingType: [...(prev.sharingType ?? []), type],
      }
    })
  }

  const toggleTypeFilter = (type: ActivityType) => {
    setFilters((prev) => {
      if (prev.type === type) {
        return { ...prev, type: undefined }
      }
      return { ...prev, type }
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

      <TagHeader
        text={t('shared.generic.sharing')}
        state={sharingTypeVisible}
        setState={setSharingTypeVisible}
      />
      {sharingTypeVisible && (
        <ul className="list-none">
          {[SharingType.Owned, SharingType.Shared, SharingType.Dependency].map(
            (type) => (
              <TagItem
                key={type}
                text={t(`manage.sharing.label${type as SharingType}`)}
                icon={SHARING_TYPE_FILTERS[type]}
                active={filters.sharingType?.includes(type) ?? false}
                onClick={() => toggleSharingTypeFilter(type)}
                data={{ cy: `sharing-filter-${type}` }}
              />
            )
          )}
        </ul>
      )}

      <TagHeader
        text={t('manage.activities.activityType')}
        state={typesVisible}
        setState={setTypesVisible}
      />
      {typesVisible && (
        <ul className="list-none">
          {[
            ActivityType.LiveQuiz,
            ActivityType.PracticeQuiz,
            ActivityType.MicroLearning,
            ActivityType.GroupActivity,
          ].map((type) => (
            <TagItem
              key={type}
              text={t(`shared.types.${type}`)}
              icon={TYPE_ICONS[type]}
              active={filters.type === type}
              onClick={() => toggleTypeFilter(type)}
              data={{ cy: `type-filter-${type.toLowerCase()}` }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ActivityOverviewFilters
