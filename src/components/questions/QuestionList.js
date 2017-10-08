import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { graphql } from 'react-apollo'
import { compose, withPropsOnChange } from 'recompose'

import Question from './Question'
import { filterQuestions } from '../../lib/utils/filters'
import { QuestionListQuery } from '../../queries/queries'

const propTypes = {
  creationMode: PropTypes.bool,
  dropped: PropTypes.arrayOf(PropTypes.string),
  error: PropTypes.string,
  loading: PropTypes.bool.isRequired,
  onQuestionDropped: PropTypes.func.isRequired,
  questions: PropTypes.array,
}

const defaultProps = {
  creationMode: false,
  dropped: [],
  error: undefined,
  questions: [],
}

export const QuestionListPres = ({
  error,
  loading,
  questions,
  dropped,
  onQuestionDropped,
  creationMode,
}) => {
  if (loading) {
    return <div>Loading</div>
  }

  if (error) {
    return <div>{error}</div>
  }

  return (
    <div>
      {questions.map(question => (
        <div className="question">
          {
            <Question
              key={question.id}
              id={question.id}
              lastUsed={question.instances.map(instance =>
                moment(instance.createdAt).format('DD.MM.YYYY HH:MM:SS'),
              )}
              tags={question.tags.map(tag => tag.name)}
              title={question.title}
              type={question.type}
              version={question.versions.length}
              draggable={creationMode && !dropped.includes(question.id)}
              creationMode={creationMode}
              onDrop={onQuestionDropped(question.id)}
            />
          }
        </div>
      ))}

      <style jsx>
        {`
          .question {
            margin-bottom: 2rem;
          }
        `}
      </style>
    </div>
  )
}

QuestionListPres.propTypes = propTypes
QuestionListPres.defaultProps = defaultProps

export default compose(
  graphql(QuestionListQuery),
  withPropsOnChange(['data', 'filters'], ({ data: { loading, error, questions }, filters }) => ({
    error,
    loading,
    questions: questions && (filters ? filterQuestions(questions, filters) : questions),
  })),
)(QuestionListPres)
