import {
  faCheckCircle as faCheckCircleRegular,
  faCircleXmark,
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
  faX,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  PublicationStatus,
  SharingType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
  sharingType: SharingType[]
  type?: ActivityType
  course?: string | null // null means "unassigned", undefined means "all courses"
}

function ActivityOverviewFilters({
  filters,
  setFilters,
  availableCourses = [],
  filtersActive = false,
}: {
  filters: ActivityOverviewFilterType
  setFilters: Dispatch<SetStateAction<ActivityOverviewFilterType>>
  availableCourses?: { id: string; name: string }[]
  filtersActive: boolean
}) {
  const t = useTranslations()
  const [statusVisible, setStatusVisible] = useState(true)
  const [sharingTypeVisible, setSharingTypeVisible] = useState(true)
  const [typesVisible, setTypesVisible] = useState(true)
  const [coursesVisible, setCoursesVisible] = useState(true)

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

  const toggleCourseFilter = (course: string | null) => {
    setFilters((prev) => {
      if (prev.course === course) {
        return { ...prev, course: undefined }
      }
      return { ...prev, course }
    })
  }

  return (
    <div className="flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-56">
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
          {[
            SharingType.Owned,
            SharingType.Shared,
            ...(filters.sharingType.includes(SharingType.Shared)
              ? [SharingType.Dependency]
              : []),
          ].map((type) => (
            <TagItem
              key={type}
              text={t(`manage.sharing.label${type as SharingType}`)}
              icon={SHARING_TYPE_FILTERS[type]}
              active={filters.sharingType.includes(type)}
              onClick={() => toggleSharingTypeFilter(type)}
              data={{ cy: `sharing-filter-${type}` }}
            />
          ))}
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

      {availableCourses.length > 0 && (
        <>
          <TagHeader
            text={t('shared.generic.courses')}
            state={coursesVisible}
            setState={setCoursesVisible}
          />
          {coursesVisible && (
            <ul className="list-none">
              <TagItem
                key="unassigned"
                text={t('manage.activities.noCourseAssigned')}
                icon={[faX, faX]}
                active={filters.course === null}
                onClick={() => toggleCourseFilter(null)}
                data={{ cy: 'course-filter-unassigned' }}
              />
              {availableCourses.map((course) => (
                <TagItem
                  key={course.id}
                  text={course.name}
                  icon={[faUserGroup, faUserGroup]}
                  active={filters.course === course.id}
                  onClick={() => toggleCourseFilter(course.id)}
                  data={{
                    cy: `course-filter-${course.name.toLowerCase().replace(/\s+/g, '-')}`,
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Button
        className={{
          root: twMerge('mt-2 h-8 text-sm', filtersActive && 'border-red-600'),
        }}
        disabled={!filtersActive}
        onClick={() => {
          setFilters({
            status: [],
            sharingType: [
              SharingType.Owned,
              SharingType.Shared,
              SharingType.Dependency,
            ],
            type: undefined,
            course: undefined,
          })
        }}
        data={{ cy: 'reset-question-pool-filters' }}
      >
        <Button.Icon className={{ root: 'mr-1' }} icon={faCircleXmark} />
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>
    </div>
  )
}

export default ActivityOverviewFilters
