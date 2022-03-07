import React from 'react'
import { v4 as UUIDv4 } from 'uuid'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'
import { FormattedMessage, defineMessages, useIntl } from 'react-intl'
import { object } from 'yup'
import {
  removeQuestion,
  moveQuestion,
  addToBlock,
  appendNewBlock,
  reorder,
  deleteArrayElement,
} from '../../../lib/utils/move'

import QuestionSingle from '../../questions/QuestionSingle'
import QuestionDropzone from './QuestionDropzone'
import InfoArea from './InfoArea'

import validationSchema from '../common/validationSchema'
import SessionParticipantsModal, {
  DataStorageMode,
  AuthenticationMode,
} from './participantsModal/SessionParticipantsModal'

const { sessionName: sessionNameValidator } = validationSchema

const messages = defineMessages({
  sessionNamePlaceholder: {
    defaultMessage: 'Session Name',
    id: 'form.createSession.sessionName',
  },
})

interface Props {
  sessionBlocks: any
  handleSetSessionBlocks: any
  runningSessionId: string
  sessionName: string
  isAuthenticationEnabled: boolean
  sessionParticipants: any[]
  handleSetSessionName: any
  handleSetSessionParticipants: any
  handleSetIsAuthenticationEnabled: any
  handleCreateSession: any
  handleCreationModeToggle: any
  sessionInteractionType?: string
  sessionAuthenticationMode: AuthenticationMode
  sessionDataStorageMode: DataStorageMode
  handleSetSessionAuthenticationMode: any
  handleSetSessionDataStorageMode: any
}

const defaultProps = {
  sessionBlocks: [],
  sessionInteractionType: 'CREATE',
}

const getItemStyle = (isDragging, draggableStyle): any => ({
  // change background colour if dragging
  background: isDragging ? 'white' : 'grey',

  // some basic styles to make the items look a bit nicer
  userSelect: 'none',

  // styles we need to apply on draggables
  ...draggableStyle,
})

const getListStyle = (isDraggingOver): any => ({
  background: isDraggingOver ? 'lightblue' : 'white',
})

function SessionCreationForm({
  sessionBlocks,
  handleSetSessionBlocks,
  runningSessionId,
  sessionName,
  sessionParticipants,
  isAuthenticationEnabled,
  handleSetIsAuthenticationEnabled,
  handleSetSessionName,
  handleSetSessionParticipants,
  handleCreateSession,
  handleCreationModeToggle,
  sessionInteractionType,
  sessionAuthenticationMode,
  sessionDataStorageMode,
  handleSetSessionAuthenticationMode,
  handleSetSessionDataStorageMode,
}: Props): React.ReactElement {
  const intl = useIntl()

  const onChangeName = (e): void => handleSetSessionName(e.target.value)

  const onExtendBlock = (blockId, question): void => {
    handleSetSessionBlocks(addToBlock(sessionBlocks, blockId, question))
  }

  const onManageBlocks = ({ source, destination }): void => {
    if (!source || !destination) {
      return null
    }

    // if the item was dropped in a new block
    if (destination.droppableId === 'new-block') {
      // generate a new uuid for the new block
      const blockId = UUIDv4()

      // initialize a new empty block at the end
      const extendedBlocks = [
        ...sessionBlocks,
        {
          id: blockId,
          questions: [],
        },
      ]

      // perform the move between the source and the new block
      return handleSetSessionBlocks(moveQuestion(extendedBlocks, source.droppableId, source.index, blockId, 0, true))
    }

    return handleSetSessionBlocks(
      moveQuestion(sessionBlocks, source.droppableId, source.index, destination.droppableId, destination.index, true)
    )
  }

  const onNewBlock = (question): void => handleSetSessionBlocks(appendNewBlock(sessionBlocks, question))

  // handle removal of a question with its trash button
  const onRemoveQuestion = (blockIndex, questionIndex): void => {
    handleSetSessionBlocks(removeQuestion(sessionBlocks, blockIndex, questionIndex, true))
  }

  const onReorderBlocks = (startIndex, endIndex): void => {
    handleSetSessionBlocks(reorder(sessionBlocks, startIndex, endIndex))
  }

  const onRemoveBlock = (blockIndex): void => {
    handleSetSessionBlocks(deleteArrayElement(sessionBlocks, blockIndex))
  }

  // synchronous validation
  // synchronously validate the schema
  const isValid = object()
    .shape({
      name: sessionNameValidator.required(),
    })
    .isValidSync({
      name: sessionName,
    })

  return (
    <div className="creationForm">
      <DragDropContext onDragEnd={onManageBlocks}>
        <form className="ui form sessionCreation" onSubmit={handleCreateSession('save')}>
          <div className="sessionTimeline">
            {sessionBlocks.map(
              (block, blockIndex): React.ReactElement => (
                <div className="block" key={block.id}>
                  <div className="header">
                    <div>
                      {`Block ${blockIndex + 1}`} {`(${block.questions.length})`}
                    </div>
                    <div>
                      <Button
                        basic
                        icon="arrow left"
                        size="mini"
                        type="button"
                        onClick={(): void => onReorderBlocks(blockIndex, blockIndex - 1)}
                      />
                      <Button
                        basic
                        icon="trash"
                        size="mini"
                        type="button"
                        onClick={(): void => onRemoveBlock(blockIndex)}
                      />
                      <Button
                        basic
                        icon="arrow right"
                        size="mini"
                        type="button"
                        onClick={(): void => onReorderBlocks(blockIndex, blockIndex + 1)}
                      />
                    </div>
                  </div>
                  <Droppable droppableId={block.id}>
                    {(provided, snapshot): React.ReactElement => (
                      <div className="questions" ref={provided.innerRef} style={getListStyle(snapshot.isDraggingOver)}>
                        {block.questions.map(
                          ({ id, key, title, type, version, description }, index): React.ReactElement => (
                            <Draggable draggableId={`${key}-${index}-${id}`} index={index} key={key}>
                              {(innerProvided, innerSnapshot): React.ReactElement => (
                                <div
                                  className="question"
                                  ref={innerProvided.innerRef}
                                  {...innerProvided.draggableProps}
                                  {...innerProvided.dragHandleProps}
                                  style={getItemStyle(innerSnapshot.isDragging, innerProvided.draggableProps.style)}
                                >
                                  <QuestionSingle
                                    description={description}
                                    hasParticipantCount={false}
                                    id={id}
                                    title={title}
                                    type={type}
                                    version={version}
                                    onDelete={(): void => onRemoveQuestion(blockIndex, index)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          )
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <div className="blockDropzone">
                    <QuestionDropzone
                      onDrop={(question): void => {
                        onExtendBlock(block.id, { ...question, type: question.questionType })
                      }}
                    />
                  </div>
                </div>
              )
            )}
            <div className="newBlock">
              <div className="header">
                <FormattedMessage defaultMessage="New Block" id="form.createSession.newBlock" />
              </div>
              <Droppable droppableId="new-block">
                {(provided, snapshot): React.ReactElement => (
                  <div className="questions" ref={provided.innerRef} style={getListStyle(snapshot.isDraggingOver)}>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <div className="blockDropzone">
                <QuestionDropzone
                  onDrop={(question): void => {
                    onNewBlock({ ...question, type: question.questionType })
                  }}
                />
              </div>
            </div>
            {sessionBlocks.length <= 1 && <InfoArea />}
          </div>

          <div className="sessionConfig">
            <div className="discardSession">
              <button className="ui icon button discardButton" type="button" onClick={handleCreationModeToggle}>
                <Icon name="close" />
              </button>
            </div>

            <h2 className="interactionType">
              {((): React.ReactElement => {
                if (sessionInteractionType === 'MODIFY') {
                  return <FormattedMessage defaultMessage="Modify Session" id="form.createSession.interactionModify" />
                }

                if (sessionInteractionType === 'COPY') {
                  return <FormattedMessage defaultMessage="Copy Session" id="form.createSession.interactionCopy" />
                }

                return <FormattedMessage defaultMessage="Create Session" id="form.createSession.interactionCreate" />
              })()}
            </h2>

            <div className="sessionName">
              <Input
                name="sessionName"
                placeholder={intl.formatMessage(messages.sessionNamePlaceholder)}
                value={sessionName}
                onChange={onChangeName}
              />
            </div>

            <div className="sessionParticipants">
              <SessionParticipantsModal
                authenticationMode={sessionAuthenticationMode}
                dataStorageMode={sessionDataStorageMode}
                isAuthenticationEnabled={isAuthenticationEnabled}
                participants={sessionParticipants}
                onChangeAuthenticationMode={handleSetSessionAuthenticationMode}
                onChangeDataStorageMode={handleSetSessionDataStorageMode}
                onChangeIsAuthenticationEnabled={handleSetIsAuthenticationEnabled}
                onChangeParticipants={handleSetSessionParticipants}
              />
            </div>

            <Button
              fluid
              icon
              disabled={!isValid || (isAuthenticationEnabled && sessionParticipants.length === 0)}
              labelPosition="left"
              size="small"
              type="submit"
            >
              <Icon name="save" />
              <FormattedMessage defaultMessage="Save & Close" id="form.createSession.button.save" />
            </Button>
            <Button
              fluid
              icon
              primary
              disabled={!isValid || !!runningSessionId || (isAuthenticationEnabled && sessionParticipants.length === 0)}
              labelPosition="left"
              size="small"
              onClick={handleCreateSession('start')}
            >
              <Icon name="play" />
              <FormattedMessage defaultMessage="Start" id="common.button.start" />
            </Button>
            {!!runningSessionId && (
              <FormattedMessage
                defaultMessage="A session is already running"
                id="form.createSession.string.alreadyRunning"
              />
            )}
          </div>
        </form>
      </DragDropContext>

      <style jsx>{`
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
              align-items: center;
              padding: 0 0.5rem 0.3rem 0.5rem;

              :global(button.ui.basic.button) {
                border: 0;
                box-shadow: none;
                padding: 0.5rem;
                margin-right: 0;
              }
            }

            .questions {
              flex: 1;
              padding: 0.5rem;
              overflow: auto;
              max-height: 23rem;

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

            h2.interactionType {
              border-bottom: 1px solid lightgrey;
              font-size: 1rem !important;
              margin: 0;
              padding: 0.5rem 0 0.25rem 0;
              margin-bottom: 0.5rem;
            }

            .sessionName,
            .sessionParticipants {
              flex: 1;
              margin-bottom: 0.5rem;

              label {
                font-weight: bold;
              }
            }

            :global(button) {
              margin-top: 0.5rem;
            }
          }
        }

        .creationForm {
          animation-name: slide-in;
          animation-duration: 0.75s;
        }

        @keyframes slide-in {
          0% {
            transform: translateY(300px);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

SessionCreationForm.defaultProps = defaultProps

export default SessionCreationForm
