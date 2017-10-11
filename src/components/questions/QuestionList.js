import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { graphql } from 'react-apollo'

import Question from './Question'
import { filterQuestions } from '../../lib/utils/filters'
import { QuestionListQuery } from '../../queries/queries'

const propTypes = {
  creationMode: PropTypes.bool,
  data: PropTypes.shape({
    error: PropTypes.string,
    loading: PropTypes.bool.isRequired,
    questions: PropTypes.array, // TODO: extend proptypes with schema
  }).isRequired,
  dropped: PropTypes.arrayOf(PropTypes.string),
  filters: PropTypes.object.isRequired,
  onQuestionDropped: PropTypes.func.isRequired,
}

const defaultProps = {
  creationMode: false,
  dropped: [],
}

const QuestionList = ({
  data, filters, dropped, onQuestionDropped, creationMode,
}) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  // calculate questions to show based on filter criteria
  const questions = filters ? filterQuestions(data.questions, filters) : data.questions

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

      <style jsx>{`
        .question {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

QuestionList.propTypes = propTypes
QuestionList.defaultProps = defaultProps

export default graphql(QuestionListQuery)(QuestionList)
