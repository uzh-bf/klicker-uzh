import { useQuery } from '@apollo/client'
import {
  faCheckCircle as faCheckCircleRegular,
  faCircleXmark,
  faCommentDots as faCommentDotsRegular,
  faComment as faCommentRegular,
  faEye as faEyeRegular,
  faRectangleList as faListRegular,
  faPenToSquare as faPenRegular,
  faCircleQuestion as faQuestionRegular,
  faSquareCheck as faSquareCheckRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  IconDefinition,
  faCheckCircle as faCheckCircleSolid,
  faCommentDots as faCommentDotsSolid,
  faComment as faCommentSolid,
  faEye as faEyeSolid,
  faFolderTree,
  faLink,
  faListCheck,
  faRectangleList as faListSolid,
  faPenToSquare as faPenSolid,
  faCircleQuestion as faQuestionSolid,
  faSquareCheck as faSquareCheckSolid,
  faUserTie,
} from '@fortawesome/free-solid-svg-icons'
import {
  ElementStatus,
  ElementType,
  SharingType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Accordion, Button, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import FilterItem from './FilterItem'
import FilterListEntry from './FilterListEntry'
import SuspendedActivitySelection from './SuspendedActivitySelection'
import SuspendedTags from './SuspendedTags'

const ELEMENT_STATUS_FILTERS: Record<ElementStatus, IconDefinition[]> = {
  [ElementStatus.Draft]: [faPenRegular, faPenSolid],
  [ElementStatus.Review]: [faEyeRegular, faEyeSolid],
  [ElementStatus.Ready]: [faCheckCircleRegular, faCheckCircleSolid],
}

export const SHARING_TYPE_FILTERS: Record<SharingType, IconDefinition[]> = {
  [SharingType.Owned]: [faUserTie, faUserTie],
  [SharingType.Shared]: [faLink, faLink],
  [SharingType.Dependency]: [faFolderTree, faFolderTree],
}

interface FilterListProps {
  defaultValue?: string
  filtersActive: boolean
  isArchiveActive: boolean
  showUntagged: boolean
  activeTags: string[]
  activeCourseId?: string
  activeActivityId?: string
  activeStatus?: ElementStatus
  activeType?: ElementType
  activeSharingTypes?: SharingType[]
  sampleSolution: boolean
  answerFeedbacks: boolean
  handleReset: () => void
  handleTagClick: ({
    valueOrId,
    isTypeTag,
    isStatusTag,
    isSharingTypeTag,
    isUntagged,
  }: {
    valueOrId: string
    isTypeTag: boolean
    isStatusTag: boolean
    isSharingTypeTag: boolean
    isUntagged: boolean
  }) => void
  toggleCourseIdFilter: ({ courseId }: { courseId?: string }) => void
  toggleActivityIdFilter: ({ activityId }: { activityId?: string }) => void
  toggleSampleSolutionFilter: () => void
  toggleAnswerFeedbackFilter: () => void
  handleToggleArchive: () => void
  refetchElements: () => Promise<void>
}

function FilterList({
  defaultValue = 'element-status',
  filtersActive,
  isArchiveActive,
  showUntagged,
  activeTags,
  activeCourseId,
  activeActivityId,
  activeType,
  activeStatus,
  activeSharingTypes,
  sampleSolution,
  answerFeedbacks,
  handleTagClick,
  toggleCourseIdFilter,
  toggleActivityIdFilter,
  handleReset,
  toggleSampleSolutionFilter,
  toggleAnswerFeedbackFilter,
  handleToggleArchive,
  refetchElements,
}: FilterListProps): React.ReactElement {
  const t = useTranslations()

  const { data: user } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const ELEMENT_TYPE_FILTERS: Record<
    ElementType,
    IconDefinition[] | undefined
  > = {
    CONTENT: [faCommentRegular, faCommentSolid],
    FLASHCARD: [faListRegular, faListSolid],
    SC: [faQuestionRegular, faQuestionSolid],
    MC: [faQuestionRegular, faQuestionSolid],
    KPRIM: [faQuestionRegular, faQuestionSolid],
    FREE_TEXT: [faQuestionRegular, faQuestionSolid],
    NUMERICAL: [faQuestionRegular, faQuestionSolid],
    SELECTION: user?.userProfile?.privatePreview
      ? [faSquareCheckRegular, faSquareCheckSolid]
      : undefined,
    CASE_STUDY: user?.userProfile?.privatePreview
      ? [faListCheck, faListCheck]
      : undefined,
  }

  return (
    <div className="flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-56">
      <Accordion type="single" defaultValue={defaultValue} className="w-full">
        <FilterListEntry
          trigger={t('manage.questionPool.elementStatus')}
          value="element-status"
          active={!!activeStatus}
          data={{ cy: 'collapse-tag-header-status' }}
        >
          {Object.entries(ELEMENT_STATUS_FILTERS).map(([status, icons]) => (
            <FilterItem
              key={status}
              text={t(`shared.${status as ElementStatus}.statusLabel`)}
              icon={icons}
              active={activeStatus === status}
              onClick={(): void =>
                handleTagClick({
                  valueOrId: status,
                  isTypeTag: false,
                  isStatusTag: true,
                  isSharingTypeTag: false,
                  isUntagged: false,
                })
              }
            />
          ))}
        </FilterListEntry>

        <FilterListEntry
          trigger={t('manage.questionPool.elementTypes')}
          value="element-types"
          active={!!activeType}
          data={{ cy: 'collapse-tag-header-types' }}
        >
          {Object.entries(ELEMENT_TYPE_FILTERS).map(([type, icons]) => {
            if (!icons) return null

            return (
              <FilterItem
                key={type}
                text={t(`shared.${type as ElementType}.typeLabel`)}
                icon={icons}
                active={activeType === type}
                onClick={(): void => {
                  // if flashcards / content elements are selected -> disable sample solution
                  if (
                    (type === ElementType.Flashcard ||
                      type === ElementType.Content) &&
                    sampleSolution
                  ) {
                    toggleSampleSolutionFilter()
                  }

                  // if an element type different from SC, MC, KPRIM is selected -> disable answer feedbacks
                  if (
                    type !== ElementType.Sc &&
                    type !== ElementType.Mc &&
                    type !== ElementType.Kprim &&
                    answerFeedbacks
                  ) {
                    toggleAnswerFeedbackFilter()
                  }

                  handleTagClick({
                    valueOrId: type,
                    isTypeTag: true,
                    isStatusTag: false,
                    isSharingTypeTag: false,
                    isUntagged: false,
                  })
                }}
                data={{ cy: `element-type-filter-${type}` }}
              />
            )
          })}
        </FilterListEntry>

        {user?.userProfile?.privatePreview ? (
          <FilterListEntry
            trigger={t('shared.generic.sharing')}
            value="sharing-types"
            active={activeSharingTypes?.length !== 3}
            data={{ cy: `collapse-tag-header-sharing` }}
          >
            {Object.entries(SHARING_TYPE_FILTERS).map(([type, icons]) => {
              // do not show dependenccy filter, if shared elements are not shown
              if (
                type === SharingType.Dependency &&
                !activeSharingTypes?.includes(SharingType.Shared)
              ) {
                return null
              }

              return (
                <FilterItem
                  key={type}
                  text={t(`manage.sharing.label${type as SharingType}`)}
                  icon={icons}
                  active={
                    activeSharingTypes?.includes(type as SharingType) ?? false
                  }
                  onClick={(): void =>
                    handleTagClick({
                      valueOrId: type,
                      isTypeTag: false,
                      isStatusTag: false,
                      isSharingTypeTag: true,
                      isUntagged: false,
                    })
                  }
                  data={{ cy: `element-sharing-filter-${type}` }}
                />
              )
            })}
          </FilterListEntry>
        ) : null}

        <FilterListEntry
          trigger={t('manage.questionPool.tags')}
          value="user-tags"
          active={activeTags.length > 0 || showUntagged}
          data={{ cy: `collapse-tag-header-user-tags` }}
        >
          <Suspense fallback={<Loader />}>
            <SuspendedTags
              showUntagged={showUntagged}
              activeTags={activeTags}
              handleTagClick={handleTagClick}
              refetchElements={refetchElements}
            />
          </Suspense>
        </FilterListEntry>

        <FilterListEntry
          trigger={t('manage.questionPool.activityUsage')}
          value="used-in-activity"
          active={typeof activeActivityId !== 'undefined'}
          data={{ cy: `collapse-tag-header-used-in-activity` }}
        >
          <Suspense fallback={<Loader />}>
            <SuspendedActivitySelection
              activeCourseId={activeCourseId}
              activeActivityId={activeActivityId}
              toggleCourseIdFilter={toggleCourseIdFilter}
              toggleActivityIdFilter={toggleActivityIdFilter}
            />
          </Suspense>
        </FilterListEntry>

        <FilterListEntry
          trigger={t('shared.generic.gamification')}
          value="gamification-tags"
          active={sampleSolution || answerFeedbacks}
          data={{
            cy: `collapse-tag-header-${t('shared.generic.gamification')}`,
          }}
        >
          <FilterItem
            disabled={
              activeType === ElementType.Flashcard ||
              activeType === ElementType.Content
            }
            text={t('shared.generic.sampleSolution')}
            icon={[faCheckCircleRegular, faCheckCircleSolid]}
            active={sampleSolution}
            onClick={toggleSampleSolutionFilter}
            tooltip={
              activeType === ElementType.Flashcard ||
              activeType === ElementType.Content
                ? t('manage.questionPool.sampleSolutionUnavailableTypes')
                : undefined
            }
            data={{ cy: 'sample-solution-filter' }}
          />
          <FilterItem
            disabled={
              activeType &&
              activeType !== ElementType.Sc &&
              activeType !== ElementType.Mc &&
              activeType !== ElementType.Kprim
            }
            text={t('manage.questionPool.answerFeedbacks')}
            icon={[faCommentDotsRegular, faCommentDotsSolid]}
            active={answerFeedbacks}
            onClick={toggleAnswerFeedbackFilter}
            tooltip={
              activeType &&
              activeType !== ElementType.Sc &&
              activeType !== ElementType.Mc &&
              activeType !== ElementType.Kprim
                ? t('manage.questionPool.answerFeedbacksUnavailableTypes')
                : undefined
            }
            data={{ cy: 'answer-feedback-filter' }}
          />
        </FilterListEntry>
      </Accordion>

      <div className="mt-2">
        <Switch
          size="sm"
          label={t('manage.questionPool.showArchived')}
          checked={isArchiveActive}
          onCheckedChange={(): void => handleToggleArchive()}
          className={{ label: 'font-normal' }}
          data={{ cy: 'show-archive-switch' }}
        />
      </div>

      <Button
        className={{
          root: twMerge('mt-2 h-8 text-sm', filtersActive && 'border-red-600'),
        }}
        disabled={!filtersActive}
        onClick={(): void => handleReset()}
        data={{ cy: 'reset-question-pool-filters' }}
      >
        <Button.Icon className={{ root: 'mr-1' }} icon={faCircleXmark} />
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>
    </div>
  )
}

export default FilterList
