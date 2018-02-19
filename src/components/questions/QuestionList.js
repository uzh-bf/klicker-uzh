import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { graphql } from 'react-apollo'
import { branch, compose, renderComponent, withProps } from 'recompose'
import { FormattedMessage } from 'react-intl'

import Question from './Question'
import { LoadingDiv } from '../common'
import { processItems } from '../../lib'
import QuestionListQuery from '../../graphql/queries/QuestionListQuery.graphql'

const propTypes = {
  creationMode: PropTypes.bool,
  dropped: PropTypes.arrayOf(PropTypes.string),
  onQuestionDropped: PropTypes.func.isRequired,
  questions: PropTypes.array,
}

const defaultProps = {
  creationMode: false,
  dropped: [],
  questions: [],
}

export const QuestionListPres = ({
  questions, dropped, onQuestionDropped, creationMode,
}) => (
  <div className="questionList">
    {questions.length === 0 ? (
      <div className="message">
        <FormattedMessage
          defaultMessage="No questions available."
          id="questionList.string.noQuestions"
        />
      </div>
    ) : (
      []
    )}

    {questions.map(question => (
      <Question
        creationMode={creationMode}
        draggable={creationMode && !dropped.includes(question.id)}
        id={question.id}
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
        onDrop={onQuestionDropped(question.id)}
      />
    ))}

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

export default compose(
  graphql(QuestionListQuery),
  branch(({ data }) => data.loading, renderComponent(LoadingDiv)),
  branch(({ data }) => data.error, renderComponent(({ data }) => <div>{data.error}</div>)),
  withProps(({ data: { error, questions }, filters, sort }) => ({
    error,
    // questions: questions && (filters ? filterQuestions(questions, filters) : questions),
    questions: processItems(questions, filters, sort),
  })),
)(QuestionListPres)
