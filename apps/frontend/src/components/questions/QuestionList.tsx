import React from 'react'
import dayjs from 'dayjs'
import { Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Question from './Question'
import QuestionCompact from './QuestionCompact'

interface Props {
  creationMode?: boolean
  isArchiveActive?: boolean
  onQuestionChecked: any
  selectedItems: any
  questions?: any[]
  questionView?: string
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
  questions: [],
  questionView: 'block',
}

function QuestionList({
  onQuestionChecked,
  creationMode,
  selectedItems,
  isArchiveActive,
  questions,
  questionView,
}: Props): React.ReactElement {
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
    <div className="questionList">
      {questionView === 'list' &&
        questions.map((question): any => (
          <Question
            checked={selectedItems.ids.includes(question.id)}
            creationMode={creationMode}
            draggable={creationMode}
            id={question.id}
            isArchived={isArchiveActive}
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
            // onDrop={() => null}
          />
        ))}

      {questionView === 'grid' && (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {questions.map((question): any => (
            <QuestionCompact
              checked={selectedItems.ids.includes(question.id)}
              creationMode={creationMode}
              draggable={creationMode}
              id={question.id}
              isArchived={isArchiveActive}
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
              // onDrop={() => null}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .questionList {
          :global(> *) {
            margin-bottom: 1rem;
          }

          .message {
            margin-bottom: 1rem;
            padding: 0.75rem;
            border: 1px solid lightgray;
            background-color: #f9f9f9;
          }
        }
      `}</style>
    </div>
  )
}

QuestionList.defaultProps = defaultProps

export default QuestionList
