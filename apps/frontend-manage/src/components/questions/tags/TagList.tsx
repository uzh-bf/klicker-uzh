import { useQuery } from '@apollo/client'
import {
  faCheckCircle,
  faCircleXmark,
  faRectangleList as faListRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCommentDots,
  faRectangleList as faListSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserTagsDocument, Tag } from '@klicker-uzh/graphql/dist/ops'
import {
  QUESTION_TYPES,
  TYPES_LABELS,
} from '@klicker-uzh/shared-components/src/constants'
import { Button, UserNotification } from '@uzh-bf/design-system'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagHeader from './TagHeader'
import TagItem from './TagItem'
import UserTag from './UserTag'

interface Props {
  compact: boolean
  activeTags: string[]
  activeType: string
  sampleSolution: boolean
  answerFeedbacks: boolean
  handleReset: () => void
  handleTagClick: (questionType: string, selected?: boolean) => void
  handleSampleSolutionClick: (selected?: boolean) => void
  handleAnswerFeedbacksClick: (selected?: boolean) => void
}

// TODO: re-add archive toggle
function TagList({
  compact,
  activeTags,
  activeType,
  sampleSolution,
  answerFeedbacks,
  handleTagClick,
  handleReset,
  handleSampleSolutionClick,
  handleAnswerFeedbacksClick,
}: Props): React.ReactElement {
  const {
    data: tagsData,
    loading: tagsLoading,
    error: tagsError,
  } = useQuery(GetUserTagsDocument)

  const [questionTypesVisible, setQuestionTypesVisible] = useState(!compact)
  const [userTagsVisible, setUserTagsVisible] = useState(!compact)
  const [gamificationTagsVisible, setGamificationTagsVisible] = useState(
    !compact
  )

  const tags = tagsData?.userTags?.map((tag) => {
    return { name: tag.name, id: tag.id }
  })

  return (
    <div className="p-4 md:w-[18rem] border border-uzh-grey-60 border-solid md:max-h-full rounded-md h-full text-[0.9rem] overflow-y-auto">
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
        <Button.Label>Filter zurücksetzen</Button.Label>
      </Button>

      {/* <Button
          className={twMerge(
            isArchiveActive && 'text-red-600',
            'w-full text-base bg-white sm:hover:bg-grey-40 sm:hover:text-red-600 !py-[0.2rem] mb-2 flex flex-row justify-center'
          )}
          onClick={(): void => handleToggleArchive(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faBoxArchive} />
          </Button.Icon>
          <Button.Label>Archiv Anzeigen</Button.Label>
        </Button> */}

      <div>
        <TagHeader
          text="Fragetypen"
          state={questionTypesVisible}
          setState={setQuestionTypesVisible}
        />
        {questionTypesVisible && (
          <ul className="list-none">
            {Object.values(QUESTION_TYPES).map((type) => (
              <TagItem
                key={type}
                text={TYPES_LABELS[type]}
                icon={activeType === type ? faListSolid : faListRegular}
                active={activeType === type}
                onClick={(): void => handleTagClick(type, true)}
              />
            ))}
          </ul>
        )}

        <TagHeader
          text="Tags"
          state={userTagsVisible}
          setState={setUserTagsVisible}
        />
        {userTagsVisible &&
          ((): React.ReactElement => {
            if (tagsLoading) {
              return <div>Loading...</div>
            }

            if (tagsError) {
              return (
                <UserNotification type="error" message={tagsError.message} />
              )
            }

            if (tags?.length === 0) {
              return (
                <UserNotification type="info">
                  Keine Tags verfügbar
                </UserNotification>
              )
            }

            return (
              <ul className="list-none">
                {tags?.map(
                  (tag: Tag, index: number): React.ReactElement => (
                    <UserTag
                      key={index}
                      tag={tag}
                      handleTagClick={handleTagClick}
                      active={activeTags.includes(tag.name)}
                    />
                  )
                )}
              </ul>
            )
          })()}

        <TagHeader
          text="Gamification"
          state={gamificationTagsVisible}
          setState={setGamificationTagsVisible}
        />
        {gamificationTagsVisible && (
          <ul className="list-none">
            <TagItem
              text="Musterlösung"
              icon={faCheckCircle}
              active={sampleSolution}
              onClick={(): void => handleSampleSolutionClick(!sampleSolution)}
            />
            <TagItem
              text="Antwort-Feedbacks"
              icon={faCommentDots}
              active={answerFeedbacks}
              onClick={(): void => {
                handleAnswerFeedbacksClick(!answerFeedbacks)
              }}
            />
          </ul>
        )}
      </div>
    </div>
  )
}

export default TagList
