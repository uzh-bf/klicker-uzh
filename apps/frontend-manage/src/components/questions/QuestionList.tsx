import type { Question as QuestionType } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import React from 'react'

import { useTranslations } from 'next-intl'
import Question from './Question'

interface QuestionListProps {
  setSelectedQuestions: (questionId: number, questionData: QuestionType) => void
  selectedQuestions: Record<number, QuestionType>
  questions?: QuestionType[]
  tagfilter?: string[]
  unsetDeletedQuestion: (questionId: number) => void
}

function QuestionList({
  setSelectedQuestions,
  selectedQuestions,
  questions = [],
  tagfilter = [],
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
      {questions.map((question): any => (
        <Question
          checked={!!selectedQuestions[question.id]}
          id={question.id}
          isArchived={question.isArchived}
          key={question.id}
          tags={question.tags || []}
          title={question.name}
          type={question.type}
          content={question.content}
          hasAnswerFeedbacks={question.hasAnswerFeedbacks}
          hasSampleSolution={question.hasSampleSolution}
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
