import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { Query } from 'react-apollo'

import Question from './Question'
import { processItems, buildIndex } from '../../lib'
import { QuestionListQuery } from '../../graphql'

const propTypes = {
  creationMode: PropTypes.bool,
  filters: PropTypes.object.isRequired,
  isArchiveActive: PropTypes.bool,
  onQuestionChecked: PropTypes.func.isRequired,
  // FIXME: immutable ordered map
  selectedItems: PropTypes.any.isRequired,
  sort: PropTypes.object.isRequired,
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
}

export const QuestionListPres = ({
  filters,
  sort,
  onQuestionChecked,
  creationMode,
  selectedItems,
  isArchiveActive,
}) => (
  <div className="questionList">
    <Query query={QuestionListQuery}>
      {({ data: { questions }, error, loading }) => {
        if (loading) {
          return <Loader active />
        }

        if (error) {
          return <Message error>{error.message}</Message>
        }

        if (questions.length === 0) {
          return (
            <Message info>
              <FormattedMessage
                defaultMessage="No questions available."
                id="questionList.string.noQuestions"
              />
            </Message>
          )
        }

        // build an index from the received questions
        const index = buildIndex('questions', questions, [
          'title',
          'createdAt',
          ['versions', 0, 'description'],
        ])

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

        return processedQuestions.map(question => (
          <Question
            checked={selectedItems.has(question.id)}
            creationMode={creationMode}
            draggable={creationMode}
            id={question.id}
            isArchived={isArchiveActive}
            key={question.id}
            lastUsed={question.instances.map(({ createdAt, session, version }) => (
              <a href={`/sessions/evaluation/${session}`} target="_blank">
                {moment(createdAt).format('DD.MM.YYYY HH:mm')} (v{version + 1})
              </a>
            ))}
            tags={question.tags}
            title={question.title}
            type={question.type}
            versions={question.versions}
            onCheck={onQuestionChecked(question.id, question)}
            // onDrop={() => null}
          />
        ))
      }}
    </Query>

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

QuestionListPres.propTypes = propTypes
QuestionListPres.defaultProps = defaultProps

export default QuestionListPres
