import {
  faCheckCircle,
  faCircleXmark,
  faComment as faCommentRegular,
  faRectangleList as faListRegular,
  faCircleQuestion as faQuestionRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  IconDefinition,
  faArchive,
  faCommentDots,
  faComment as faCommentSolid,
  faRectangleList as faListSolid,
  faCircleQuestion as faQuestionSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { Suspense, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SuspendedTags from './SuspendedTags'
import TagHeader from './TagHeader'
import TagItem from './TagItem'

interface Props {
  compact: boolean
  isArchiveActive: boolean
  activeTags: string[]
  activeType?: ElementType
  sampleSolution: boolean
  answerFeedbacks: boolean
  handleReset: () => void
  handleTagClick: (tagName: string, isQuestionTag: boolean) => void
  toggleSampleSolutionFilter: () => void
  toggleAnswerFeedbackFilter: () => void
  handleToggleArchive: () => void
}

function TagList({
  compact,
  isArchiveActive,
  activeTags,
  activeType,
  sampleSolution,
  answerFeedbacks,
  handleTagClick,
  handleReset,
  toggleSampleSolutionFilter,
  toggleAnswerFeedbackFilter,
  handleToggleArchive,
}: Props): React.ReactElement {
  const t = useTranslations()

  const [questionTypesVisible, setQuestionTypesVisible] = useState(!compact)
  const [userTagsVisible, setUserTagsVisible] = useState(!compact)
  const [gamificationTagsVisible, setGamificationTagsVisible] = useState(
    !compact
  )

  const elementTypeFilters: Record<ElementType, IconDefinition[]> = {
    FLASHCARD: [faListRegular, faListSolid],
    CONTENT: [faCommentRegular, faCommentSolid],
    SC: [faQuestionRegular, faQuestionSolid],
    MC: [faQuestionRegular, faQuestionSolid],
    KPRIM: [faQuestionRegular, faQuestionSolid],
    FREE_TEXT: [faQuestionRegular, faQuestionSolid],
    NUMERICAL: [faQuestionRegular, faQuestionSolid],
  }

  const resetDisabled = useMemo(
    () =>
      !(
        activeTags.length > 0 ||
        activeType ||
        sampleSolution ||
        answerFeedbacks
      ),
    [activeTags, activeType, sampleSolution, answerFeedbacks]
  )

  return (
    <div className="flex flex-col flex-1 h-max max-h-full p-4 md:w-[18rem] border border-uzh-grey-60 border-solid rounded-md text-[0.9rem] overflow-y-auto">
      <Button
        className={{
          root: twMerge(
            'w-full text-base bg-white sm:hover:bg-grey-40 !py-[0.2rem] mb-1.5 flex flex-row items-center justify-center',
            !resetDisabled && 'text-primary'
          ),
        }}
        disabled={resetDisabled}
        onClick={(): void => handleReset()}
        data={{ cy: 'reset-question-pool-filters' }}
      >
        <Button.Icon className={{ root: 'mr-1' }}>
          <FontAwesomeIcon icon={faCircleXmark} />
        </Button.Icon>
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>

      <TagHeader
        text={t('manage.questionPool.elementTypes')}
        state={questionTypesVisible}
        setState={setQuestionTypesVisible}
      />
      {questionTypesVisible && (
        <ul className="list-none">
          {Object.entries(elementTypeFilters).map(([type, icons]) => (
            <TagItem
              key={type}
              text={t(`shared.${type as ElementType}.typeLabel`)}
              icon={activeType === type ? icons[1] : icons[0]}
              active={activeType === type}
              onClick={(): void => handleTagClick(type, true)}
            />
          ))}
        </ul>
      )}

      <TagHeader
        text={t('manage.questionPool.tags')}
        state={userTagsVisible}
        setState={setUserTagsVisible}
      />

      {userTagsVisible && (
        <Suspense fallback={<Loader />}>
          <SuspendedTags
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
            text={t('shared.generic.sampleSolution')}
            icon={faCheckCircle}
            active={sampleSolution}
            onClick={toggleSampleSolutionFilter}
          />
          <TagItem
            text={t('manage.questionPool.answerFeedbacks')}
            icon={faCommentDots}
            active={answerFeedbacks}
            onClick={toggleAnswerFeedbackFilter}
          />
        </ul>
      )}

      <div className="mt-4">
        <Button
          fluid
          className={{
            root: twMerge(isArchiveActive && 'text-red-600'),
          }}
          onClick={(): void => handleToggleArchive()}
          data={{ cy: 'toggle-archive-question-pool' }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faArchive} />
          </Button.Icon>
          <Button.Label>
            {isArchiveActive
              ? t('manage.questionPool.hideArchived')
              : t('manage.questionPool.showArchived')}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default TagList
