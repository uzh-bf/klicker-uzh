import React from 'react'
import dayjs from 'dayjs'
import { Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Question from './Question'

interface Props {
  onQuestionChecked: any
  selectedItems: any
  questions?: any[]
}

const defaultProps = {
  isArchiveActive: false,
  questions: [],
}

function QuestionList({ onQuestionChecked, selectedItems, questions }: Props): React.ReactElement {
  if (!questions) {
    return null
  }

  if (questions.length === 0) {
    return (
      <Message info>
        <FormattedMessage
          defaultMessage="No questions matching your specified criteria."
          id="questionList.string.noMatchingQuestions"
        />
      </Message>
    )
  }

  return (
    <div className="mb-4">
      {questions.map((question): any => (
        <Question
          checked={selectedItems.ids.includes(question.id)}
          id={question.id}
          isArchived={question.isArchived}
          key={question.id}
          lastUsed={Array.from(
            question.instances
              .filter((instance): boolean => !!instance)
              .reduce((prevMap, { createdAt, session }): any => {
                // if there is already a link to the session, skip the duplicate
                if (prevMap.has(session)) {
                  return prevMap
                }

                // append the session link to the map
                return prevMap.set(
                  session,
                  <a href={`/sessions/evaluation/${session}`} rel="noopener noreferrer" target="_blank">
                    {dayjs(createdAt).format('DD.MM.YYYY HH:mm')}
                  </a>
                )
              }, new Map())
              .values()
          )}
          tags={question.tags}
          title={question.title}
          type={question.type}
          versions={question.versions}
          onCheck={onQuestionChecked(question.id, question)}
        />
      ))}
    </div>
  )
}

QuestionList.defaultProps = defaultProps

export default QuestionList
