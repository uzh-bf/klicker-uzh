import { Question as QuestionType } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'

import Question from './Question'

interface QuestionListProps {
  setSelectedQuestions: (questionIndex: number) => void
  selectedQuestions: boolean[]
  questions?: QuestionType[]
}

const defaultProps = {
  questions: [],
}

function QuestionList({
  setSelectedQuestions,
  selectedQuestions,
  questions,
}: QuestionListProps): React.ReactElement {
  if (!questions) {
    return <></>
  }

  if (questions.length === 0) {
    return <div>No questions matching your specified criteria.</div>
  }

  return (
    <div className="mb-4">
      {questions.map((question, index): any => (
        <Question
          checked={selectedQuestions[index]}
          id={question.id}
          isArchived={question.isArchived}
          key={question.id}
          tags={question.tags || []}
          title={question.name}
          type={question.type}
          content={question.content}
          onCheck={() => setSelectedQuestions(index)}
        />
      ))}
    </div>
  )
}

QuestionList.defaultProps = defaultProps

export default QuestionList
