import React from 'react'
import dayjs from 'dayjs'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { useQuery } from 'react-apollo'

import Question from './Question'
import { processItems, buildIndex } from '../../lib'
import { QuestionListQuery } from '../../graphql'

interface Props {
  creationMode?: boolean
  filters: any
  isArchiveActive?: boolean
  onQuestionChecked: any
  selectedItems: any
  sort: any
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
}

function QuestionList({
  filters,
  sort,
  onQuestionChecked,
  creationMode,
  selectedItems,
  isArchiveActive,
}: Props): React.ReactElement {
  const { data, error, loading } = useQuery(QuestionListQuery)

  return (
    <div className="questionList">
      {((): React.ReactNode => {
        if (loading) {
          return <Loader active />
        }

        if (error) {
          return <Message error>{error.message}</Message>
        }

        const { questions } = data

        if (questions.length === 0) {
          return (
            <Message info>
              <FormattedMessage defaultMessage="No questions available." id="questionList.string.noQuestions" />
            </Message>
          )
        }

        // build an index from the received questions
        const index = buildIndex('questions', questions, ['title', 'createdAt', ['versions', 0, 'description']])

        // process questions according to filters and sort settings
        const processedQuestions = processItems(questions, filters, sort, index)

        if (processedQuestions.length === 0) {
          return (
            <Message info>
              <FormattedMessage
                defaultMessage="No questions matching your specified criteria."
                id="questionList.string.noMatchingQuestions"
              />
            </Message>
          )
        }

        return processedQuestions.map((question): any => (
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
        ))
      })()}

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
