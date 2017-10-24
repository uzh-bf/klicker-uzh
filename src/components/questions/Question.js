import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { DragSource } from 'react-dnd'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

const propTypes = {
  connectDragSource: PropTypes.func.isRequired,
  creationMode: PropTypes.bool,
  description: PropTypes.string,
  draggable: PropTypes.bool,
  id: PropTypes.string.isRequired,
  isDragging: PropTypes.bool,
  lastUsed: PropTypes.array,
  tags: PropTypes.array,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  version: PropTypes.number,
}

const defaultProps = {
  creationMode: false,
  description: '-',
  draggable: false,
  isDragging: false,
  lastUsed: [],
  tags: [],
  version: 1,
}

const Question = ({
  id,
  lastUsed,
  tags,
  title,
  type,
  description,
  version,
  draggable,
  creationMode,
  isDragging,
  connectDragSource,
}) =>
  connectDragSource(
    <div className={classNames('question', { creationMode, draggable, isDragging })}>
      {creationMode && (
        <div className={classNames('sessionMembership', { active: !draggable })}>
          <input
            type="checkbox"
            className="ui checkbox"
            name={`check-${id}`}
            checked={!draggable}
            onClick={() => null}
          />
        </div>
      )}

      <div className="wrapper">
        <h2 className="title">
          {title} {version && version > 1 && `(v${version})`}
        </h2>

        <div className="tags">
          <QuestionTags tags={tags} type={type} />
        </div>

        <div className="details">
          <QuestionDetails description={description} lastUsed={lastUsed} />
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .question {
          display: flex;
          flex-flow: column nowrap;

          &.draggable {
            cursor: grab;

            &:hover {
              box-shadow: 3px 3px 5px grey;
            }
          }

          &.isDragging {
            opacity: 0.5;
          }

          .sessionMembership {
            flex: 0 0 auto;
            display: flex;

            color: darkred;
            padding: 0.5rem;
            text-align: left;

            .active {
              color: green;
            }
          }

          .wrapper {
            display: flex;
            flex-flow: column nowrap;

            .title {
              font-size: 1.2rem;
              margin: 0;
              //margin-bottom: 0.5rem;
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;

            .sessionMembership {
              flex: 0 0 1rem;
              display: flex;
              align-items: center;

              padding: 1rem;
            }

            .wrapper {
              flex: 1;
              flex-flow: row wrap;

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
          }
        }
      `}</style>
    </div>,
  )

Question.propTypes = propTypes
Question.defaultProps = defaultProps

// define the source for DnD
const source = {
  // only props defined here are "transported" to the dropzone
  beginDrag({ id, title, type }) {
    return { id, title, type }
  },
  // whether the element can be dragged
  canDrag({ draggable }) {
    return draggable
  },
  // if the element is dropped somewhere
  endDrag({ onDrop }, monitor) {
    if (monitor.didDrop()) {
      onDrop()
    }
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
