// @flow

import React from 'react'
import moment from 'moment'
import { graphql } from 'react-apollo'

import Question from './Question'
import { QuestionListQuery } from '../../queries/queries'
import type { QuestionListType } from '../../queries/queries'

type Props = {
  data: QuestionListType,
}

const QuestionList = ({ data }: Props) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  return (
    <div>
      {data.questions.map(question => (
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

export default graphql(QuestionListQuery)(QuestionList)
