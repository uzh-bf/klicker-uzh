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
      {data.allQuestions.map(question => <Question key={question.id} {...question} />)}
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
      allQuestions {
        id
        title
      }
    }
  `,
)(QuestionList)
