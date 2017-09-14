// @flow

import React from 'react'
import classNames from 'classnames'
import { DragSource } from 'react-dnd'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

type Props = {
  id: string,
  lastUsed: Array<string>,
  tags: Array<string>,
  title: string,
  type: string,
  version: number,
  isDragging: boolean,
  connectDragSource: any,
}

const defaultProps = {
  version: 1,
}

const Question = ({
  id,
  lastUsed,
  tags,
  title,
  type,
  version,
  isDragging,
  connectDragSource,
}: Props) =>
  connectDragSource(
    <div className={classNames('container', { isDragging })}>
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

          opacity: 1;
          cursor: grab;
        }

        .container.isDragging {
          opacity: 0.5;
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
    </div>,
  )

Question.defaultProps = defaultProps

// define the source for DnD
const source = {
  // only props defined here are "transported" to the dropzone
  beginDrag({ id, title, type }) {
    return { id, title, type }
  },
}

// define what information the Question component should collect
// we need to know whether the current question is being dragged
const collect = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging(),
})

// define a unique item type "question"
const withDnD = DragSource('question', source, collect)

export default withDnD(Question)
