import {
  faCheckCircle as faCheckCircleRegular,
  faCircleXmark,
  faClock as faClockRegular,
  faPenToSquare as faPenToSquareRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  fa1,
  fa2,
  fa3,
  fa4,
  faCheckCircle as faCheckCircleSolid,
  faCheckDouble,
  faClock as faClockSolid,
  faFilePen,
  faGraduationCap,
  faListCheck,
  faLock,
  faPenToSquare as faPenToSquareSolid,
  faPlay,
  faQuestion,
  faQuestionCircle,
  faShieldHalved,
  faStamp,
  faTriangleExclamation,
  faTrophy,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Accordion, Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import {
  ActivityType,
  PublicationStatus,
  ReviewStatus,
} from '../../../lib/constants/activityEnums'
import { SharingType } from '../../../lib/constants/sharingEnums'
import type { ActivityModeFilters } from '../../../lib/hooks/useActivitySortingAndFiltering'
import FilterItem from '../../elements/tags/FilterItem'
import { SHARING_TYPE_FILTERS } from '../../elements/tags/FilterList'
import FilterListEntry from '../../elements/tags/FilterListEntry'

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

const MULTIPLIER_ICONS = {
  '1': [fa1, fa1],
  '2': [fa2, fa2],
  '3': [fa3, fa3],
  '4': [fa4, fa4],
}

const REVIEW_STATUS_ICONS = {
  [ReviewStatus.Incomplete]: [faQuestion, faQuestion],
  [ReviewStatus.Reviewed]: [faCheckDouble, faCheckDouble],
  [ReviewStatus.ModifiedAfterReview]: [
    faTriangleExclamation,
    faTriangleExclamation,
  ],
}

export type ActivityOverviewFilterType = {
  status: PublicationStatus[]
  sharingType: SharingType[]
  type?: ActivityType
  multiplier?: number | null
  reviewStatus?: ReviewStatus | null
  course?: string | null // null means "unassigned", undefined means "all courses"
  mode: ActivityModeFilters
}

function ActivityOverviewFilters({
  filters,
  toggleStatusFilter,
  toggleSharingTypeFilter,
  toggleActivityTypeFilter,
  toggleCourseFilter,
  toggleMultiplierFilter,
  toggleReviewStatusFilter,
  toggleModeFilter,
  handleReset,
  availableCourses = [],
  availableCoursesError = false,
  availableCoursesLoading = false,
  filtersActive = false,
}: {
  filters: ActivityOverviewFilterType
  toggleStatusFilter: (status: PublicationStatus) => void
  toggleSharingTypeFilter: (type: SharingType) => void
  toggleActivityTypeFilter: (type: ActivityType) => void
  toggleCourseFilter: (course: string | null) => void
  toggleMultiplierFilter: (multiplier: number | null) => void
  toggleReviewStatusFilter: (reviewStatus: ReviewStatus | null) => void
  toggleModeFilter: (mode: keyof ActivityModeFilters) => void
  handleReset: () => void
  availableCourses?: { id: string; name: string }[]
  availableCoursesError?: boolean
  availableCoursesLoading?: boolean
  filtersActive: boolean
}) {
  const t = useTranslations()
  const showCourseFilters =
    availableCourses.length > 0 ||
    availableCoursesLoading ||
    availableCoursesError

  return (
    <div className="flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-56">
      <Accordion type="single" defaultValue="status-filters" className="w-full">
        <FilterListEntry
          trigger={t('shared.generic.status')}
          value="status-filters"
          active={filters.status.length > 0}
          data={{ cy: `collapse-tag-header-status` }}
        >
          {[
            PublicationStatus.Draft,
            PublicationStatus.Scheduled,
            PublicationStatus.Published,
            PublicationStatus.Ended,
            PublicationStatus.Graded,
            PublicationStatus.Template,
          ].map((status) => (
            <FilterItem
              key={status}
              text={t(`shared.${status}.statusLabel`)}
              icon={STATUS_ICONS[status]}
              active={filters.status.includes(status)}
              onClick={() => toggleStatusFilter(status)}
              data={{ cy: `status-filter-${status.toLowerCase()}` }}
            />
          ))}
        </FilterListEntry>

        <FilterListEntry
          trigger={t('shared.generic.sharing')}
          value="sharing-filters"
          active={filters.sharingType.length !== 3}
          data={{ cy: `collapse-tag-header-sharing` }}
        >
          {[
            SharingType.Owned,
            SharingType.Shared,
            ...(filters.sharingType.includes(SharingType.Shared)
              ? [SharingType.Dependency]
              : []),
          ].map((type) => (
            <FilterItem
              key={type}
              text={t(`manage.sharing.label${type as SharingType}`)}
              icon={SHARING_TYPE_FILTERS[type]}
              active={filters.sharingType.includes(type)}
              onClick={() => toggleSharingTypeFilter(type)}
              data={{ cy: `sharing-filter-${type}` }}
            />
          ))}
        </FilterListEntry>

        <FilterListEntry
          trigger={t('manage.activities.activityType')}
          value="type-filters"
          active={filters.type !== undefined}
          data={{ cy: `collapse-tag-header-activity-type` }}
        >
          {[
            ActivityType.LiveQuiz,
            ActivityType.PracticeQuiz,
            ActivityType.MicroLearning,
            ActivityType.GroupActivity,
          ].map((type) => (
            <FilterItem
              key={type}
              text={t(`shared.types.${type}`)}
              icon={TYPE_ICONS[type]}
              active={filters.type === type}
              onClick={() => toggleActivityTypeFilter(type)}
              data={{ cy: `type-filter-${type.toLowerCase()}` }}
            />
          ))}
        </FilterListEntry>

        <FilterListEntry
          trigger={t('manage.activities.modeFilters')}
          value="mode-filters"
          active={Object.values(filters.mode).some((value) => value)}
          data={{ cy: `collapse-tag-header-mode` }}
        >
          {[
            {
              key: 'gamified' as const,
              label: t('shared.generic.gamified'),
              icon: [faTrophy, faTrophy],
              dataCy: 'mode-filter-gamified',
            },
            {
              key: 'assessment' as const,
              label: t('shared.generic.assessment'),
              icon: [faShieldHalved, faShieldHalved],
              dataCy: 'mode-filter-assessment',
            },
            {
              key: 'pinProtected' as const,
              label: t('shared.generic.pinProtected'),
              icon: [faLock, faLock],
              dataCy: 'mode-filter-pin-protected',
            },
          ].map((mode) => (
            <FilterItem
              key={mode.key}
              text={mode.label}
              icon={mode.icon}
              active={filters.mode[mode.key]}
              onClick={() => toggleModeFilter(mode.key)}
              data={{ cy: mode.dataCy }}
            />
          ))}
        </FilterListEntry>

        {showCourseFilters && (
          <FilterListEntry
            trigger={t('shared.generic.courses')}
            value="course-filters"
            active={filters.course !== undefined}
            data={{ cy: `collapse-tag-header-courses` }}
          >
            {availableCoursesLoading && availableCourses.length === 0 ? (
              <Loader />
            ) : (
              <>
                {availableCoursesError ? (
                  <UserNotification
                    type="error"
                    message={t('shared.generic.systemError')}
                    className={{ root: 'mb-1 py-1 text-sm' }}
                  />
                ) : null}
                {availableCourses.length > 0 ? (
                  <>
                    <FilterItem
                      key="unassigned"
                      text={t('manage.activities.noCourseAssigned')}
                      icon={[faX, faX]}
                      active={filters.course === null}
                      onClick={() => toggleCourseFilter(null)}
                      data={{ cy: 'course-filter-unassigned' }}
                    />
                    {availableCourses.map((course) => (
                      <FilterItem
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
                  </>
                ) : null}
              </>
            )}
          </FilterListEntry>
        )}

        <FilterListEntry
          trigger={t('shared.generic.multiplier')}
          value="multiplier-filters"
          active={filters.multiplier !== undefined}
          data={{ cy: `collapse-tag-header-multiplier` }}
        >
          {['1', '2', '3', '4'].map((multiplier) => (
            <FilterItem
              key={multiplier}
              text={t(
                `manage.activityWizard.multiplier${multiplier as '1' | '2' | '3' | '4'}`
              )}
              icon={MULTIPLIER_ICONS[multiplier as '1' | '2' | '3' | '4']}
              active={String(filters.multiplier) === multiplier}
              onClick={() => toggleMultiplierFilter(parseInt(multiplier, 10))}
              data={{ cy: `multiplier-filter-${multiplier}` }}
            />
          ))}
        </FilterListEntry>

        <FilterListEntry
          trigger={t('shared.generic.reviewStatus')}
          value="review-status-filters"
          active={filters.reviewStatus !== undefined}
          data={{ cy: `collapse-tag-header-review-status` }}
        >
          {[
            ReviewStatus.Incomplete,
            ReviewStatus.Reviewed,
            ReviewStatus.ModifiedAfterReview,
          ].map((status) => (
            <FilterItem
              key={status}
              text={t(`shared.generic.reviewStatus${status}`)}
              icon={REVIEW_STATUS_ICONS[status]}
              active={filters.reviewStatus === status}
              onClick={() => toggleReviewStatusFilter(status)}
              data={{ cy: `review-status-filter-${status}` }}
            />
          ))}
        </FilterListEntry>
      </Accordion>

      <Button
        className={{
          root: twMerge('mt-2 h-8 text-sm', filtersActive && 'border-red-600'),
        }}
        disabled={!filtersActive}
        onClick={handleReset}
        data={{ cy: 'reset-question-pool-filters' }}
      >
        <Button.Icon className={{ root: 'mr-1' }} icon={faCircleXmark} />
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>
    </div>
  )
}

export default ActivityOverviewFilters
