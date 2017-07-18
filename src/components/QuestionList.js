import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'
import { Segment } from 'semantic-ui-react'

import withCSS from '../lib/withCSS'

const QuestionList = ({ data, head }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  return (
    <div>
      {head}

      {data.allQuestions.map(question =>
        (<Segment key={question.id}>
          {question.title}
        </Segment>),
      )}
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
  head: PropTypes.node.isRequired,
}

const QuestionListWithCSS = withCSS(QuestionList, ['segment'])

export default graphql(
  gql`
    {
      allQuestions {
        id
        title
      }
    }
  `,
)(QuestionListWithCSS)
