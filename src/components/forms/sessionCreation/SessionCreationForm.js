import React from 'react'
import PropTypes from 'prop-types'
import { Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'

import QuestionSingle from '../../questions/QuestionSingle'

const propTypes = {
  blocks: PropTypes.array,
  handleChangeBlocks: PropTypes.func.isRequired,
  handleChangeName: PropTypes.func.isRequired,
  handleDiscard: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  isSessionRunning: PropTypes.bool,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  blocks: [],
  isSessionRunning: false,
}

const getItemStyle = (isDragging, draggableStyle) => ({
  // change background colour if dragging
  background: isDragging ? 'white' : 'grey',

  // some basic styles to make the items look a bit nicer
  userSelect: 'none',

  // styles we need to apply on draggables
  ...draggableStyle,
})

const getListStyle = isDraggingOver => ({
  background: isDraggingOver ? 'lightblue' : 'white',
})

const SessionCreationForm = ({
  name,
  blocks,
  isSessionRunning,
  handleChangeBlocks,
  handleChangeName,
  handleDiscard,
  handleSubmit,
}) => (
  <div className="ui form sessionCreation">
    <div className="sessionTimeline">
      {blocks.map((block, blockIndex) => (
        <div className="block" key={block.id}>
          <div className="header">
            {`Block ${blockIndex + 1}`}
          </div>
          <Droppable droppableId={block.id}>
            {(provided, snapshot) => (
              <div
                className="questions"
                ref={provided.innerRef}
                style={getListStyle(snapshot.isDraggingOver)}
              >
                {block.questions.map(({ id, title, type }, index) => (
                  <Draggable draggableId={id} index={index} key={id}>
                    {(innerProvided, innerSnapshot) => (
                      <div
                        className="question"
                        ref={innerProvided.innerRef}
                        {...innerProvided.draggableProps}
                        {...innerProvided.dragHandleProps}
                        style={getItemStyle(
                          innerSnapshot.isDragging,
                          innerProvided.draggableProps.style,
                        )}
                      >
                        <QuestionSingle noDetails title={title} type={type} />
                      </div>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      ))}
      <div className="newBlock">
        <div className="header">
New Block
        </div>
        <Droppable droppableId="new-block">
          {(provided, snapshot) => (
            <div
              className="questions"
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
            >
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
    <div className="sessionConfig">
      <Input value={name} onChange={handleChangeName} />
      <Button basic fluid primary>
        Save
      </Button>
      <Button basic fluid primary>
        Start
      </Button>
    </div>
    <style jsx>
      {`
        .sessionCreation {
          border: 1px solid lightgrey;
          display: flex;

          .sessionTimeline {
            display: flex;
            flex: 1;

            .block,
            .newBlock {
              display: flex;
              flex-direction: column;
              width: 150px;
            }

            .header {
              border-bottom: 1px solid lightgrey;
              font-weight: bold;
              padding: 0.25rem;
              text-align: center;
            }

            .questions {
              border-right: 1px solid lightgrey;
              flex: 0 0 10rem;
              padding: 0.5rem;
            }

            .questions {
              .question:not(:first-child) {
                margin-top: 3px;
              }
            }

            .dropzone {
              background-color: lightgrey;
              height: 3rem;
              text-align: center;
            }
          }

          .sessionConfig {
            flex: 0 0 15rem;
            padding: 1rem;
          }
        }
      `}
    </style>
  </div>
)

SessionCreationForm.propTypes = propTypes
SessionCreationForm.defaultProps = defaultProps

export default SessionCreationForm
