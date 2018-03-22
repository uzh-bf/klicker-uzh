import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { adjust } from 'ramda'
import { FormattedMessage } from 'react-intl'
import { Icon, Message } from 'semantic-ui-react'
import { compose, withHandlers } from 'recompose'
import { Droppable, Draggable, DragDropContext } from 'react-beautiful-dnd'
import QuestionDropzone from './QuestionDropzone'
import QuestionSingle from '../../questions/QuestionSingle'

const propTypes = {
  handleExtendBlock: PropTypes.func.isRequired,
  handleNewBlock: PropTypes.func.isRequired,
  value: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      questions: PropTypes.arrayOf(
        PropTypes.shape({
          title: PropTypes.string.isRequired,
          type: PropTypes.string.isRequired,
        }),
      ),
    }),
  ).isRequired,
}

const SessionTimelineInput = ({
  value,
  handleNewBlock,
  handleExtendBlock,
  onDragStart,
  onDragEnd,
}) => (
  <div className="sessionTimeline">
    <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
      {value.map((block, blockIndex) => (
        <div className="timelineItem" key={block.id}>
          <div className="title">
            <span>Block {blockIndex + 1}</span>
            {/* <Icon name="settings" /> */}
          </div>

          <div className="questions">
            <Droppable droppableId={`block-${blockIndex}`} type="QUESTION">
              {(provided, snapshot) => (
                <div ref={provided.innerRef}>
                  {block.questions.map((q, questionIndex) => (
                    <Draggable draggableId={`question-${q.id}`} index={questionIndex} key={q.id} type="QUESTION">
                      {(provided2, snapshot2) => (
                        <div>
                          <div
                            ref={provided2.innerRef}
                            {...provided2.draggableProps}
                            {...provided2.dragHandleProps}
                          >
                            <QuestionSingle
                              id={q.id}
                              title={q.title}
                              type={q.type}
                              version={q.version}
                            />
                          </div>
                          {provided2.placeholder}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          <div className="questionDropzone">
            <QuestionDropzone onDrop={handleExtendBlock(blockIndex)} />
          </div>
        </div>
      ))}

      <div className="timelineItem">
        <div className="title">
          <FormattedMessage defaultMessage="New Block" id="sessionCreation.newBlock" />
          <a data-tip data-for="newBlockHelp">
            <Icon name="question circle" />
          </a>
        </div>

        <ReactTooltip delayHide={250} delayShow={250} id="newBlockHelp" place="right">
          <FormattedMessage
            defaultMessage="Group questions inside a question block to activate and evaluate them simultaneously."
            id="sessionCreation.newBlock.tooltip"
          />
        </ReactTooltip>

        <div className="blockDropzone">
          <QuestionDropzone onDrop={handleNewBlock} />
        </div>

        {value.length === 0 && (
          <div className="message">
            <Message info>
              <FormattedMessage
                defaultMessage="Drag & drop a question into the dropzone."
                id="sessionCreation.emptyDropzoneInfo"
              />
            </Message>
          </div>
        )}
      </div>
    </DragDropContext>
    <style jsx>{`
      @import 'src/theme';

      .sessionTimeline {
        display: flex;
        flex-direction: column;

        height: 100%;
        padding: 0.5rem;

        > .timelineItem {
          display: flex;
          flex-direction: column;
          max-height: 25rem;
          overflow: hidden;

          .questions {
            overflow-y: auto;
          }

          padding: 0.5rem;

          > :global(*):not(:first-child) {
            margin-top: -2px;
          }

          .title {
            display: flex;
            flex-direction: row;
            justify-content: space-between;

            font-weight: bold;
            margin-bottom: 0.5rem;

            a {
              color: $color-primary;
              font-size: 1.25rem;
            }
          }

          .message,
          .questionDropzone {
            margin-top: 0.5rem;
          }

          .questions {
            font-size: 0.9rem;

            > :global(*):not(:first-child) {
              margin-top: -2px;
            }
          }
        }

        @include desktop-tablet-only {
          flex-flow: row wrap;

          border-left: 1px solid lightgrey;
          border-bottom: 1px solid lightgrey;

          > .timelineItem {
            width: 15rem;

            &:not(:last-child) {
              border-right: 1px solid lightgrey;
              margin-bottom: 0;
            }
          }
        }
      }
    `}</style>
  </div>
)

SessionTimelineInput.propTypes = propTypes

export default compose(
  withHandlers({
    // handle extending a block with a further question
    handleExtendBlock: ({ onChange, value }) => blockIndex => (newQuestion) => {
      onChange(
        adjust(
          prev => ({ ...prev, questions: [...prev.questions, newQuestion] }),
          blockIndex,
          value,
        ),
      )
    },

    // handle creation of an entirely new block
    handleNewBlock: ({ onChange, value }) => (newQuestion) => {
      onChange([...value, { questions: [newQuestion] }])
    },

    onDragEnd: ({ value, onChange }) => ({ source, destination }) => {
      if (!destination) {
        return
      }

      console.log(source, destination, value, onChange)

      // TODO:

      // onChange(tempValue)
    },
    onDragStart: () => (a) => {
      console.log(a)
    },
  }),
)(SessionTimelineInput)
