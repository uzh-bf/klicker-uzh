import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import moment from 'moment'
import { compose, withState, withProps } from 'recompose'
import { DragSource } from 'react-dnd'
import { Dropdown } from 'semantic-ui-react'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

const propTypes = {
  connectDragSource: PropTypes.func.isRequired,
  creationMode: PropTypes.bool,
  draggable: PropTypes.bool,
  id: PropTypes.string.isRequired,
  isDragging: PropTypes.bool,
  lastUsed: PropTypes.array,
  tags: PropTypes.array,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

const defaultProps = {
  creationMode: false,
  draggable: false,
  isDragging: false,
  lastUsed: [],
  tags: [],
}

const Question = ({
  activeVersion,
  id,
  lastUsed,
  tags,
  title,
  type,
  description,
  versions,
  draggable,
  creationMode,
  isDragging,
  connectDragSource,
  handleSetActiveVersion,
}) =>
  connectDragSource(
    <div className={classNames('question', { creationMode, draggable, isDragging })}>
      {creationMode && (
        <div className={classNames('sessionMembership', { active: !draggable })}>
          <input
            checked={!draggable}
            className="ui checkbox"
            name={`check-${id}`}
            type="checkbox"
            onClick={() => null}
          />
        </div>
      )}

      <div className="wrapper">
        <h2 className="title">{title}</h2>

        <div className="versionChooser">
          <Dropdown
            disabled={versions.length === 1}
            options={versions.map((version, index) => ({
              key: index,
              text: `v${index + 1} - ${moment(version.createdAt).format('DD.MM.YYYY HH:mm')}`,
              value: index,
            }))}
            value={activeVersion}
            onChange={(param, data) => handleSetActiveVersion(data.value)}
          />
        </div>

        <div className="tags">
          <QuestionTags tags={tags} type={type} />
        </div>

        <div className="details">
          <QuestionDetails description={description} lastUsed={lastUsed} questionId={id} />
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .question {
          display: flex;
          flex-flow: column nowrap;

          padding: 10px;
          border: 1px solid lightgray;
          background-color: #f9f9f9;

          &.draggable {
            cursor: grab;

            &:hover {
              box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.1);
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
              .versionChooser {
                flex: 0 0 auto;
              }

              .versionChooser {
                padding-top: 2px;
                padding-left: 1rem;
              }

              .tags {
                flex: 1 1 auto;
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
  beginDrag({
    activeVersion, id, title, type,
  }) {
    return {
      id,
      title,
      type,
      version: activeVersion,
    }
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

export default compose(
  withState('activeVersion', 'handleSetActiveVersion', ({ versions }) => versions.length - 1),
  withProps(({ activeVersion, versions }) => ({
    description: versions[activeVersion].description,
  })),
  withDnD,
)(Question)
