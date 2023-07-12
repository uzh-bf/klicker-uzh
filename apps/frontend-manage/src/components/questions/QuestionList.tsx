import { Question as QuestionType } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import React from 'react'

import Question from './Question'

interface QuestionListProps {
  setSelectedQuestions: (questionId: number) => void
  selectedQuestions: Record<number, boolean>
  questions?: QuestionType[]
  tagfilter?: string[]
}

function QuestionList({
  setSelectedQuestions,
  selectedQuestions,
  questions = [],
  tagfilter = [],
}: QuestionListProps): React.ReactElement {
  if (!questions) {
    return <></>
  }

  if (questions.length === 0) {
    return (
      <UserNotification
        type="warning"
        className={{ root: 'ml-7 text-sm' }}
        message="Wir konnten leider keine Fragen finden, welche den gewünschten Kriterien entsprechen. Bitte versuchen Sie es mit anderen Filtern oder erstellen Sie eine neue Frage."
      />
    )
  }

  return (
    <>
      {questions.map((question): any => (
        <Question
          checked={selectedQuestions[question.id]}
          id={question.id}
          isArchived={question.isArchived}
          key={question.id}
          tags={question.tags || []}
          title={question.name}
          type={question.type}
          content={question.content}
          hasAnswerFeedbacks={question.hasAnswerFeedbacks}
          hasSampleSolution={question.hasSampleSolution}
          onCheck={() => setSelectedQuestions(question.id)}
          tagfilter={tagfilter}
          createdAt={question.createdAt}
          updatedAt={question.updatedAt}
        />
      ))}
    </>
  )
}

export default QuestionList
