import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'

const QuestionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  return (
    <div>
      <ul>
        {data.allQuestions.map(question =>
          (<li key={question.id}>
            {question.title}
          </li>),
        )}
      </ul>
    </div>
  )
}

QuestionList.propTypes = {
  data: PropTypes.shape({
    allQuestions: PropTypes.shape({
      id: PropTypes.number,
      title: PropTypes.string,
    }),
  }).isRequired,
}

export default graphql(
  gql`
    {
      allQuestions {
        id
        title
      }
    }
  `,
)(QuestionList)
