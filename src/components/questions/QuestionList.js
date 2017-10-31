import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { graphql } from 'react-apollo'
import { compose, withProps, branch, renderComponent } from 'recompose'

import Question from './Question'
import { LoadingDiv } from '../common'
import { filterQuestions } from '../../lib'
import { QuestionListQuery } from '../../graphql/queries'

const propTypes = {
  creationMode: PropTypes.bool,
  dropped: PropTypes.arrayOf(PropTypes.string),
  error: PropTypes.string,
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
  questions,
  dropped,
  onQuestionDropped,
  creationMode,
}) => {
  if (error) {
    return <div>{error}</div>
  }

  return (
    <div className="questionList">
      {questions.map(question => (
        <Question
          key={question.id}
          id={question.id}
          lastUsed={question.instances.map(instance =>
            moment(instance.createdAt).format('DD.MM.YYYY HH:MM:SS'),
          )}
          tags={question.tags}
          title={question.title}
          type={question.type}
          version={question.versions.length}
          description={question.versions[question.versions.length - 1].description}
          draggable={creationMode && !dropped.includes(question.id)}
          creationMode={creationMode}
          onDrop={onQuestionDropped(question.id)}
        />
      ))}

      <style jsx>{`
        .questionList > :global(*) {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  )
}

QuestionListPres.propTypes = propTypes
QuestionListPres.defaultProps = defaultProps

export default compose(
  graphql(QuestionListQuery),
  branch(props => props.data.loading, renderComponent(LoadingDiv)),
  withProps(({ data: { error, questions }, filters }) => ({
    error,
    questions: questions && (filters ? filterQuestions(questions, filters) : questions),
  })),
)(QuestionListPres)
