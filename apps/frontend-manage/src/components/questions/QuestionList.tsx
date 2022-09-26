import dayjs from 'dayjs'
import React from 'react'

import Question from './Question'

interface Props {
  onQuestionChecked: any // TODO: typing
  selectedItems: any // TODO: typing
  questions?: any[] // TODO: typing
}

const defaultProps = {
  isArchiveActive: false,
  questions: [],
}

function QuestionList({
  onQuestionChecked,
  selectedItems,
  questions,
}: Props): React.ReactElement {
  if (!questions) {
    return <></>
  }

  if (questions.length === 0) {
    return <div>No questions matching your specified criteria.</div>
  }

  return (
    <div className="mb-4">
      {questions.map((question): any => (
        <Question
          // checked={selectedItems.ids.includes(question.id)} // TODO: readd
          id={question.id}
          isArchived={question.isArchived}
          key={question.id}
          tags={question.tags}
          title={question.title}
          type={question.type}
          contentPlain={question.contentPlain}
          onCheck={onQuestionChecked(question.id, question)}
        />
      ))}
    </div>
  )
}

QuestionList.defaultProps = defaultProps

export default QuestionList
