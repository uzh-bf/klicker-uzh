import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'

import Question from './Question'

const QuestionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  return (
    <div>
      {data.questions.map((question) => {
        const tags = question.tags
        return (
          <div className="question">
            <Question key={question.id} tags={tags} />
          </div>
        )
      })}
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
        instances {
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
