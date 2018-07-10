import React from 'react'
import PropTypes from 'prop-types'
import { Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'

import QuestionSingle from '../../questions/QuestionSingle'
import QuestionDropzone from '../../sessions/creation/QuestionDropzone'

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
                {block.questions.map(({
                  id, title, type, version,
                }, index) => (
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
                        <QuestionSingle
                          id={id}
                          title={title}
                          type={type}
                          version={version}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          <div className="blockDropzone">
            <QuestionDropzone onDrop={() => console.log('dropped')} />
          </div>
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
        <div className="blockDropzone">
          <QuestionDropzone onDrop={() => console.log('dropped')} />
        </div>
      </div>
    </div>
    <div className="sessionConfig">
      <Input placeholder="Name..." value={name} onChange={handleChangeName} />
      <Button fluid icon labelPosition="left">
        <Icon name="trash" />
        Discard
      </Button>
      <Button fluid icon labelPosition="left">
        <Icon name="save" />
        Save
      </Button>
      <Button fluid icon primary labelPosition="left">
        <Icon name="play" />
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
            padding: 0.5rem;

            .block,
            .newBlock {
              border-right: 1px solid lightgrey;
              display: flex;
              flex-direction: column;
              width: 150px;
            }

            .header {
              font-weight: bold;
              text-align: center;
            }

            .questions {
              flex: 1;
              padding: 0.25rem 0.5rem 1rem 0.5rem;

              .question:not(:first-child) {
                margin-top: 3px;
              }
            }

            .blockDropzone {
              flex: 0 0 3rem;
              margin: 0 0.5rem;
            }
          }

          .sessionConfig {
            flex: 0 0 15rem;
            padding: 1rem;
            border-left: 1px solid lightgrey;
          }
        }
      `}
    </style>
  </div>
)

SessionCreationForm.propTypes = propTypes
SessionCreationForm.defaultProps = defaultProps

export default SessionCreationForm
