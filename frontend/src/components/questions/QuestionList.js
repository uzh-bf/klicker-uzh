import PropTypes from 'prop-types'
import React from 'react'
import moment from 'moment'
import { gql, graphql } from 'react-apollo'

import Question from './question/Question'

const QuestionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  return (
    <div>
      {data.questions.map(question =>
        (<div className="question">
          {
            <Question
              key={question.id}
              id={question.id}
              lastUsed={question.instances.map(instance => moment(instance.createdAt).format('DD.MM.YYYY HH:MM:SS'))}
              tags={question.tags.map(tag => tag.name)}
              title={question.title}
              type={question.type}
            />
          }
        </div>),
      )}

      <style jsx>{`
        .question {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

QuestionList.propTypes = {
  data: PropTypes.shape({
    allQuestions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

export default graphql(
  gql`
    {
      questions: allQuestionDefinitions {
        id
        title
        type
        instances(orderBy: createdAt_DESC, first: 3) {
          id
          createdAt
        }
        tags {
          id
          name
        }
        versions {
          id
          createdAt
        }
        createdAt
        updatedAt
      }
    }
  `,
)(QuestionList)
