import type { Element } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import React from 'react'

import { useTranslations } from 'next-intl'
import Question from './Question'

interface QuestionListProps {
  setSelectedQuestions: (questionId: number, questionData: Element) => void
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
    <div className="space-y-1 md:space-y-2">
      {questions.map((question) => (
        <Question
          checked={!!selectedQuestions[question.id]}
          id={question.id}
          isArchived={question.isArchived ?? false}
          key={question.id}
          tags={question.tags || []}
          handleTagClick={handleTagClick}
          title={question.name}
          status={question.status}
          type={question.type}
          content={question.content}
          hasAnswerFeedbacks={
            'options' in question
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
    </div>
  )
}

export default QuestionList
