import React from 'react'
import PropTypes from 'prop-types'
import { Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'

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
  // some basic styles to make the items look a bit nicer
  userSelect: 'none',

  // change background colour if dragging
  background: isDragging ? 'lightgreen' : 'grey',

  // styles we need to apply on draggables
  ...draggableStyle,
})

const getListStyle = isDraggingOver => ({
  background: isDraggingOver ? 'lightblue' : 'lightgrey',
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
      {blocks.map((block, index) => (
        <Droppable droppableId={`b-${block.id}`} index={index}>
          {(provided, snapshot) => (
            <div
              className="block"
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
            >
              {block.questions.map((question, index) => (
                <Draggable
                  draggableId={`q-${question.id}`}
                  index={index}
                  key={question.id}
                >
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
                      {question.content}
                    </div>
                  )}
                </Draggable>
              ))}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ))}
    </div>
    <div className="sessionConfig">
      <Input value={name} onChange={handleChangeName} />
    </div>
    <style jsx>
      {`
        .sessionCreation {
          display: flex;
          height: 200px;

          .sessionTimeline {
            background-color: lightgrey;
            display: flex;
            flex: 1;

            .block {
              flex: 0 0 10rem;
              padding: 0.5rem;
            }

            .question {
              border: 1px solid black;
              padding: 0.5rem;
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
