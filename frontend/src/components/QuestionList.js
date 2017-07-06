import React, { Component } from 'react'
import { gql, graphql } from 'react-apollo'

class QuestionList extends Component {
  render() {
    const { data } = this.props

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
