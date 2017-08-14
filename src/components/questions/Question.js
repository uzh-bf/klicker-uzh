// @flow

import React from 'react'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

type Props = {
  id: string,
  lastUsed: Array<string>,
  tags: Array<string>,
  title: string,
  type: string,
  version?: number,
}

const defaultProps = {
  version: 1,
}

const Question = ({ id, lastUsed, tags, title, type, version }: Props) =>
  (<div className="container">
    <h2 className="title">
      #{id.substring(0, 7)} - {title} {version && version > 1 && `(v${version})`}
    </h2>
    <div className="tags">
      <QuestionTags tags={tags} type={type} />
    </div>
    <div className="details">
      <QuestionDetails lastUsed={lastUsed} />
    </div>

    <style jsx>{`
      .container {
        display: flex;
        flex-flow: column nowrap;
      }

      .title {
        font-size: 1.2rem;
        margin: 0;
        margin-bottom: 0.5rem;
      }

      @media all and (min-width: 768px) {
        .container {
          flex-flow: row wrap;
        }

        .title,
        .tags {
          flex: 1 1 auto;
        }
        .tags {
          align-self: flex-end;
        }
        .details {
          flex: 0 0 100%;
        }
      }
    `}</style>
  </div>)

Question.defaultProps = defaultProps

export default Question
