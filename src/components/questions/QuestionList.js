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
    {questions.map(question => (
      <Question
        creationMode={creationMode}
        draggable={creationMode && !dropped.includes(question.id)}
        id={question.id}
        key={question.id}
        lastUsed={question.instances.map(instance =>
          moment(instance.createdAt).format('DD.MM.YYYY HH:MM:SS'),
        )}
        tags={question.tags}
        title={question.title}
        type={question.type}
        versions={question.versions}
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

QuestionListPres.propTypes = propTypes
QuestionListPres.defaultProps = defaultProps

export default compose(
  graphql(QuestionListQuery),
  branch(({ data }) => data.loading, renderComponent(LoadingDiv)),
  branch(({ data }) => data.error, renderComponent(({ data }) => <div>{data.error}</div>)),
  withProps(({ data: { error, questions }, filters }) => ({
    error,
    questions: questions && (filters ? filterQuestions(questions, filters) : questions),
  })),
)(QuestionListPres)
