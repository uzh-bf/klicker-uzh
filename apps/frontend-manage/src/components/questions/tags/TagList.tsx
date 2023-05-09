import { useQuery } from '@apollo/client'
import {
  faCheckCircle,
  faCircleXmark,
  faRectangleList as faListRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  faChevronDown,
  faChevronUp,
  faCommentDots,
  faRectangleList as faListSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserTagsDocument, Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button, ThemeContext, UserNotification } from '@uzh-bf/design-system'
import React, { useContext, useState } from 'react'
import { QUESTION_TYPES, TYPES_LABELS } from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import TagListItem from './TagListItem'

interface Props {
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
  activeTags,
  activeType,
  sampleSolution,
  answerFeedbacks,
  handleTagClick,
  handleReset,
  handleSampleSolutionClick,
  handleAnswerFeedbacksClick,
}: Props): React.ReactElement {
  const theme = useContext(ThemeContext)
  const {
    data: tagsData,
    loading: tagsLoading,
    error: tagsError,
  } = useQuery(GetUserTagsDocument)

  const [questionTypesVisible, setQuestionTypesVisible] = useState(true)
  const [userTagsVisible, setUserTagsVisible] = useState(false)
  const [gamificationTagsVisible, setGamificationTagsVisible] = useState(false)

  const tags = tagsData?.userTags?.map((tag) => {
    return { name: tag.name, id: tag.id }
  })

  return (
    <div className="p-4 md:w-[18rem] border border-uzh-grey-60 border-solid md:max-h-full rounded-md h-max text-[0.9rem] overflow-y-auto">
      <Button
        className={{
          root: twMerge(
            'w-full text-base bg-white sm:hover:bg-grey-40 !py-[0.2rem] mb-1.5 flex flex-row items-center justify-center',
            (activeTags.length > 0 ||
              activeType ||
              sampleSolution ||
              answerFeedbacks) &&
              theme.primaryText
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
        <div
          className={twMerge(
            'flex flex-row items-center justify-between px-4 py-0.5 mb-1 mt-3',
            'font-bold border-b border-solid border-gray-300 text-[1.05rem] text-neutral-500'
          )}
        >
          <div>Fragetypen</div>
          <FontAwesomeIcon
            icon={questionTypesVisible ? faChevronUp : faChevronDown}
            onClick={() => setQuestionTypesVisible(!questionTypesVisible)}
          />
        </div>
        {questionTypesVisible && (
          <ul className="p-0 m-0 list-none">
            {Object.values(QUESTION_TYPES).map((type) => (
              <li
                key={type}
                className={twMerge(
                  'px-4 py-0.5 hover:cursor-pointer',
                  theme.primaryTextHover,
                  activeType === type && theme.primaryText
                )}
                onClick={(): void => handleTagClick(type, true)}
              >
                <FontAwesomeIcon
                  icon={activeType === type ? faListSolid : faListRegular}
                  className="mr-2"
                />
                {TYPES_LABELS[type]}
              </li>
            ))}
          </ul>
        )}

        <div
          className={twMerge(
            'flex flex-row items-center justify-between px-4 py-0.5 mb-1 mt-3',
            'font-bold border-b border-solid border-gray-300 text-[1.05rem] text-neutral-500'
          )}
        >
          <div>Tags</div>
          <FontAwesomeIcon
            icon={userTagsVisible ? faChevronUp : faChevronDown}
            onClick={() => setUserTagsVisible(!userTagsVisible)}
          />
        </div>

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
              <ul className="p-0 m-0 list-none">
                {tags?.map(
                  (tag: Tag, index: number): React.ReactElement => (
                    <TagListItem
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

        <div
          className={twMerge(
            'flex flex-row items-center justify-between px-4 py-0.5 mb-1 mt-3',
            'font-bold border-b border-solid border-gray-300 text-[1.05rem] text-neutral-500'
          )}
        >
          <div>Gamification</div>
          <FontAwesomeIcon
            icon={gamificationTagsVisible ? faChevronUp : faChevronDown}
            onClick={() => setGamificationTagsVisible(!gamificationTagsVisible)}
          />
        </div>

        {gamificationTagsVisible && (
          <ul className="p-0 m-0 list-none">
            <li
              className={twMerge(
                'px-4 py-0.5 hover:cursor-pointer',
                theme.primaryTextHover,
                sampleSolution && theme.primaryText
              )}
              onClick={(): void => handleSampleSolutionClick(!sampleSolution)}
            >
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
              Musterlösung
            </li>
            <li
              className={twMerge(
                'px-4 py-0.5 hover:cursor-pointer',
                theme.primaryTextHover,
                answerFeedbacks && theme.primaryText
              )}
              onClick={(): void => handleAnswerFeedbacksClick(!answerFeedbacks)}
            >
              <FontAwesomeIcon icon={faCommentDots} className="mr-2" />
              Antwort-Feedbacks
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

export default TagList
