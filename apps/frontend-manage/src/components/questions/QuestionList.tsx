import { faBullhorn, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Element } from '@klicker-uzh/graphql/dist/ops'
import useStickyState from '@klicker-uzh/shared-components/src/hooks/useStickyState'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React from 'react'
import Question from './Question'

interface QuestionListProps {
  setSelectedQuestions: (id: number, data: Element) => void
  selectedQuestions: Record<number, Element>
  questions?: Element[]
  tagfilter?: string[]
  handleTagClick: (tagName: string) => void
  unsetDeletedQuestion: (questionId: number) => void
}

function QuestionList({
  setSelectedQuestions,
  selectedQuestions,
  questions = [],
  tagfilter = [],
  handleTagClick,
  unsetDeletedQuestion,
}: QuestionListProps): React.ReactElement {
  const t = useTranslations()
  const { value: hideSurvey, setValue: setHideSurvey } = useStickyState(
    'hideLecturerSurvey',
    'false'
  )

  if (!questions) {
    return <></>
  }

  if (questions.length === 0) {
    return (
      <UserNotification
        type="warning"
        className={{ root: 'ml-7 text-sm' }}
        message={t('manage.questionPool.noQuestionsWarning')}
      />
    )
  }

  return (
    <div className="bg-uzh-blue-400 space-y-1 md:space-y-2">
      {questions.map((question) => (
        <Question
          key={`question-list-element-${question.id}`}
          checked={!!selectedQuestions[question.id]}
          id={question.id}
          isArchived={question.isArchived ?? false}
          tags={question.tags || []}
          handleTagClick={handleTagClick}
          title={question.name}
          status={question.status}
          type={question.type}
          content={question.content}
          hasAnswerFeedbacks={
            'options' in question && 'hasAnswerFeedbacks' in question.options
              ? (question.options.hasAnswerFeedbacks ?? false)
              : true
          }
          hasSampleSolution={
            'options' in question
              ? (question.options.hasSampleSolution ?? false)
              : true
          }
          onCheck={() => setSelectedQuestions(question.id, question)}
          unsetDeletedQuestion={unsetDeletedQuestion}
          tagfilter={tagfilter}
          createdAt={question.createdAt}
          updatedAt={question.updatedAt}
        />
      ))}
      {hideSurvey === 'false' && (
        <div className="fixed bottom-11 w-[calc(100%-17rem)]">
          <div className="flex flex-row items-center justify-between rounded-md bg-orange-200 px-3 py-1.5">
            <div className="flex flex-row items-center gap-3">
              <FontAwesomeIcon icon={faBullhorn} className="h-6" />
              <div>
                {t.rich('manage.support.survey', {
                  link: (text) => (
                    <Link
                      href="https://uzhwwf.qualtrics.com/jfe/form/SV_a3mYp4IsylQIaay"
                      className="text-primary-80 underline"
                      target="_blank"
                    >
                      {text}
                    </Link>
                  ),
                })}
              </div>
            </div>
            <FontAwesomeIcon
              icon={faX}
              onClick={() => setHideSurvey('true')}
              className="text-gray-400 hover:cursor-pointer hover:text-black"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionList
