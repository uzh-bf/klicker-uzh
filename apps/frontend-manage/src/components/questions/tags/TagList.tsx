import {
  faCheckCircle,
  faCircleXmark,
  faRectangleList as faListRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faCommentDots,
  faRectangleList as faListSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { QuestionType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { Suspense, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SuspendedTags from './SuspendedTags'
import TagHeader from './TagHeader'
import TagItem from './TagItem'

interface Props {
  compact: boolean
  isArchiveActive: boolean
  activeTags: string[]
  activeType: string
  sampleSolution: boolean
  answerFeedbacks: boolean
  handleReset: () => void
  handleTagClick: (questionType: string, selected?: boolean) => void
  handleSampleSolutionClick: (selected?: boolean) => void
  handleAnswerFeedbacksClick: (selected?: boolean) => void
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
  handleSampleSolutionClick,
  handleAnswerFeedbacksClick,
  handleToggleArchive,
}: Props): React.ReactElement {
  const t = useTranslations()

  const [questionTypesVisible, setQuestionTypesVisible] = useState(!compact)
  const [userTagsVisible, setUserTagsVisible] = useState(!compact)
  const [gamificationTagsVisible, setGamificationTagsVisible] = useState(
    !compact
  )

  return (
    <div className="flex flex-col flex-1 h-max max-h-full p-4 md:w-[18rem] border border-uzh-grey-60 border-solid rounded-md text-[0.9rem]">
      <Button
        className={{
          root: twMerge(
            'w-full text-base bg-white sm:hover:bg-grey-40 !py-[0.2rem] mb-1.5 flex flex-row items-center justify-center',
            (activeTags.length > 0 ||
              activeType ||
              sampleSolution ||
              answerFeedbacks) &&
              'text-primary'
          ),
        }}
        disabled={
          !(
            activeTags.length > 0 ||
            activeType ||
            sampleSolution ||
            answerFeedbacks
          )
        }
        onClick={(): void => handleReset()}
      >
        <Button.Icon className={{ root: 'mr-1' }}>
          <FontAwesomeIcon icon={faCircleXmark} />
        </Button.Icon>
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>

      <TagHeader
        text={t('manage.questionPool.questionTypes')}
        state={questionTypesVisible}
        setState={setQuestionTypesVisible}
      />
      {questionTypesVisible && (
        <ul className="list-none">
          {Object.values(QuestionType).map((type) => (
            <TagItem
              key={type}
              text={t(`shared.${type}.typeLabel`)}
              icon={activeType === type ? faListSolid : faListRegular}
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
            onClick={(): void => handleSampleSolutionClick(!sampleSolution)}
          />
          <TagItem
            text={t('manage.questionPool.answerFeedbacks')}
            icon={faCommentDots}
            active={answerFeedbacks}
            onClick={(): void => {
              handleAnswerFeedbacksClick(!answerFeedbacks)
            }}
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
