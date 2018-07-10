import React from 'react'
import PropTypes from 'prop-types'
import { Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import QuestionSingle from '../../questions/QuestionSingle'
import QuestionDropzone from '../../sessions/creation/QuestionDropzone'

const propTypes = {
  blocks: PropTypes.array,
  handleChangeName: PropTypes.func.isRequired,
  handleDiscard: PropTypes.func.isRequired,
  handleExtendBlock: PropTypes.func.isRequired,
  handleNewBlock: PropTypes.func.isRequired,
  handleRemoveQuestion: PropTypes.func.isRequired,
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
  handleNewBlock,
  handleExtendBlock,
  handleRemoveQuestion,
}) => (
  <form className="ui form sessionCreation" onSubmit={handleSubmit('save')}>
    <div className="sessionTimeline">
      {blocks.map((block, blockIndex) => (
        <div className="block" key={block.id}>
          <div className="header">
            <div>
              {`Block ${blockIndex + 1}`}
            </div>
            <div>
              {`(${block.questions.size})`}
            </div>
          </div>
          <Droppable droppableId={block.id}>
            {(provided, snapshot) => (
              <div
                className="questions"
                ref={provided.innerRef}
                style={getListStyle(snapshot.isDraggingOver)}
              >
                {block.questions.map(
                  ({
                    id, key, title, type, version,
                  }, index) => (
                    <Draggable draggableId={key} index={index} key={key}>
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
                            onDelete={() => handleRemoveQuestion(blockIndex, index)
                            }
                          />
                        </div>
                      )}
                    </Draggable>
                  ),
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          <div className="blockDropzone">
            <QuestionDropzone
              onDrop={question => handleExtendBlock(block.id, question)}
            />
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
          <QuestionDropzone onDrop={handleNewBlock} />
        </div>
      </div>
    </div>
    <div className="sessionConfig">
      <div className="discardSession">
        {' '}
        <button
          className="ui icon button discardButton"
          type="button"
          onClick={handleDiscard}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="sessionName">
        <label>
          Session Name
          <Input
            name="asd"
            placeholder="Name..."
            value={name}
            onChange={handleChangeName}
          />
        </label>
      </div>
      <Button fluid icon labelPosition="left" type="submit">
        <Icon name="save" />
        <FormattedMessage
          defaultMessage="Save & Close"
          id="form.createSession.button.save"
        />
      </Button>
      <Button
        fluid
        icon
        primary
        disabled={isSessionRunning}
        labelPosition="left"
        onClick={handleSubmit('start')}
      >
        <Icon name="play" />
        <FormattedMessage defaultMessage="Start" id="common.button.start" />
      </Button>
      {isSessionRunning && (
        <FormattedMessage
          defaultMessage="A session is already running"
          id="form.createSession.string.alreadyRunning"
        />
      )}
    </div>
    <style jsx>
      {`
        @import 'src/theme';

        .sessionCreation {
          border: 1px solid lightgrey;
          display: flex;
          width: 100%;

          .sessionTimeline {
            display: flex;
            flex: 1;
            flex-flow: row wrap;
            padding: 0.5rem;
            overflow: auto;

            .block,
            .newBlock {
              border-right: 1px solid lightgrey;
              display: flex;
              flex-direction: column;
              width: 200px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              text-align: center;
              padding: 0 0.5rem;
            }

            .questions {
              flex: 1;
              padding: 0.25rem 0.5rem 1rem 0.5rem;
              overflow: auto;
              max-height: 20rem;

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
            flex: 0 0 17rem;
            padding: 1rem;
            padding-top: 0;
            border-left: 1px solid lightgrey;

            display: flex;
            flex-direction: column;

            .discardSession {
              align-self: flex-end;
              height: 2rem;
              margin-top: -2rem;

              button {
                height: 2rem;
                padding: 0.5rem 1rem;
                text-align: center;
              }
            }

            .sessionName {
              flex: 1;
              margin-top: 1rem;

              label {
                font-weight: bold;
              }
            }

            :global(button) {
              margin-top: 0.5rem;
            }
          }
        }
      `}
    </style>
  </form>
)

SessionCreationForm.propTypes = propTypes
SessionCreationForm.defaultProps = defaultProps

export default SessionCreationForm
