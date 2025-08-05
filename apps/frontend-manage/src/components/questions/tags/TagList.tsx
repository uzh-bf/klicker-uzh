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
import { Button, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { Suspense, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SuspendedTags from './SuspendedTags'
import TagHeader from './TagHeader'
import TagItem from './TagItem'

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

interface TagListProps {
  compact: boolean
  filtersActive: boolean
  isArchiveActive: boolean
  showUntagged: boolean
  activeTags: string[]
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
  toggleSampleSolutionFilter: () => void
  toggleAnswerFeedbackFilter: () => void
  handleToggleArchive: () => void
}

function TagList({
  compact,
  filtersActive,
  isArchiveActive,
  showUntagged,
  activeTags,
  activeType,
  activeStatus,
  activeSharingTypes,
  sampleSolution,
  answerFeedbacks,
  handleTagClick,
  handleReset,
  toggleSampleSolutionFilter,
  toggleAnswerFeedbackFilter,
  handleToggleArchive,
}: TagListProps): React.ReactElement {
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

  const [questionStatusVisible, setQuestionStatusVisible] = useState(!compact)
  const [questionTypesVisible, setQuestionTypesVisible] = useState(!compact)
  const [sharingTypesVisible, setSharingTypesVisible] = useState(!compact)
  const [userTagsVisible, setUserTagsVisible] = useState(!compact)
  const [gamificationTagsVisible, setGamificationTagsVisible] =
    useState(!compact)

  return (
    <div className="flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-56">
      <TagHeader
        text={t('manage.questionPool.elementStatus')}
        state={questionStatusVisible}
        setState={setQuestionStatusVisible}
      />

      {questionStatusVisible && (
        <ul className="list-none">
          {Object.entries(ELEMENT_STATUS_FILTERS).map(([status, icons]) => (
            <TagItem
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
        </ul>
      )}

      <TagHeader
        text={t('manage.questionPool.elementTypes')}
        state={questionTypesVisible}
        setState={setQuestionTypesVisible}
      />
      {questionTypesVisible && (
        <ul className="list-none">
          {Object.entries(ELEMENT_TYPE_FILTERS).map(([type, icons]) => {
            if (!icons) return null

            return (
              <TagItem
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
        </ul>
      )}

      {user?.userProfile?.privatePreview ? (
        <>
          <TagHeader
            text={t('shared.generic.sharing')}
            state={sharingTypesVisible}
            setState={setSharingTypesVisible}
          />
          {sharingTypesVisible && (
            <ul className="list-none">
              {Object.entries(SHARING_TYPE_FILTERS).map(([type, icons]) => {
                if (!icons) return null

                return (
                  <TagItem
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
            </ul>
          )}
        </>
      ) : null}

      <TagHeader
        text={t('manage.questionPool.tags')}
        state={userTagsVisible}
        setState={setUserTagsVisible}
      />
      {userTagsVisible && (
        <Suspense fallback={<Loader />}>
          <SuspendedTags
            showUntagged={showUntagged}
            activeTags={activeTags}
            handleTagClick={handleTagClick}
          />
        </Suspense>
      )}

      <TagHeader
        text={t('shared.generic.gamification')}
        state={gamificationTagsVisible}
        setState={setGamificationTagsVisible}
      />
      {gamificationTagsVisible && (
        <ul className="list-none">
          <TagItem
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
          <TagItem
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
        </ul>
      )}

      <div className="mt-5">
        <Switch
          size="sm"
          label={t('manage.questionPool.showArchived')}
          checked={isArchiveActive}
          onCheckedChange={(): void => handleToggleArchive()}
          className={{ label: 'font-normal' }}
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

export default TagList
