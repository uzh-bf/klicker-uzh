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

import QuestionSingleCompact from '../../questions/QuestionSingleCompact'
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
    <div className="w-full max-w-[100rem] mt-4">
      <DragDropContext onDragEnd={onManageBlocks}>
        <form
          className="flex w-full border-solid rounded-md ui form border-gray-40 h-[16rem]"
          onSubmit={handleCreateSession('save')}
        >
          <div className="flex flex-row flex-1 p-2 overflow-auto">
            {sessionBlocks.map(
              (block, blockIndex): React.ReactElement => (
                <div
                  className="border-0 border-r border-solid border-grey-60 flex flex-col min-w-[200px] max-w-[200px]"
                  key={block.id}
                >
                  <div className="flex justify-between font-bold text-center align-center pt-0 pr-2 pb-[0.3rem] pl-2">
                    <div className="pt-0.5">
                      {`Block ${blockIndex + 1}`} {`(${block.questions.length})`}
                    </div>
                    <div>
                      <Button
                        basic
                        className="!p-2 !mr-0 !border-0 !shadow-none"
                        icon="arrow left"
                        size="mini"
                        type="button"
                        onClick={(): void => onReorderBlocks(blockIndex, blockIndex - 1)}
                      />
                      <Button
                        basic
                        className="!p-2 !mr-0 !border-0 !shadow-none"
                        icon="trash"
                        size="mini"
                        type="button"
                        onClick={(): void => onRemoveBlock(blockIndex)}
                      />
                      <Button
                        basic
                        className="!p-2 !mr-0 !border-0 !shadow-none"
                        icon="arrow right"
                        size="mini"
                        type="button"
                        onClick={(): void => onReorderBlocks(blockIndex, blockIndex + 1)}
                      />
                    </div>
                  </div>
                  <Droppable droppableId={block.id}>
                    {(provided, snapshot): React.ReactElement => (
                      <div
                        className="flex-1 p-2 overflow-auto max-h-[10rem]"
                        ref={provided.innerRef}
                        style={getListStyle(snapshot.isDraggingOver)}
                      >
                        {block.questions.map(
                          ({ id, key, title, type }, index): React.ReactElement => (
                            <Draggable draggableId={`${key}-${index}-${id}`} index={index} key={key}>
                              {(innerProvided, innerSnapshot): React.ReactElement => (
                                <div
                                  className="!bg-white"
                                  ref={innerProvided.innerRef}
                                  {...innerProvided.draggableProps}
                                  {...innerProvided.dragHandleProps}
                                  style={getItemStyle(innerSnapshot.isDragging, innerProvided.draggableProps.style)}
                                >
                                  <QuestionSingleCompact
                                    id={id}
                                    title={title}
                                    type={type}
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
                  <div className="flex-[0_0_3rem] my-0 mx-[0.5rem]">
                    <QuestionDropzone
                      onDrop={(question): void => {
                        onExtendBlock(block.id, { ...question, type: question.questionType })
                      }}
                    />
                  </div>
                </div>
              )
            )}
            <div className="border-0 border-r border-solid border-grey-60 flex flex-col min-w-[200px]">
              <div className="flex justify-between font-bold text-center align-center pt-0.5 pr-2 pb-[0.3rem] pl-2 max-h-[10rem] min-h-[10rem]">
                <FormattedMessage defaultMessage="New Block" id="form.createSession.newBlock" />
              </div>
              <Droppable droppableId="new-block">
                {(provided, snapshot): React.ReactElement => (
                  <div
                    className="flex-1 p-2 overflow-auto max-h-[20rem]"
                    ref={provided.innerRef}
                    style={getListStyle(snapshot.isDraggingOver)}
                  >
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <div className="flex-[0_0_3rem] my-0 mx-[0.5rem]">
                <QuestionDropzone
                  onDrop={(question): void => {
                    onNewBlock({ ...question, type: question.questionType })
                  }}
                />
              </div>
            </div>
            {sessionBlocks.length <= 1 && <InfoArea />}
          </div>

          <div className="sessionConfig flex-[0_0_17rem] p-4 pt-0 border-0 border-l border-solid border-grey-60 flex flex-col">
            <div className="self-end h-8 -mt-8">
              <button
                className="h-8 px-4 py-2 text-center ui icon button"
                type="button"
                onClick={handleCreationModeToggle}
              >
                <Icon name="close" />
              </button>
            </div>

            <h2 className="px-0 pt-2 pb-1 m-0 mb-2 !text-base border-0 border-b border-solid border-grey-60">
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

            <div className="flex-1 mb-2 ">
              <Input
                name="sessionName"
                placeholder={intl.formatMessage(messages.sessionNamePlaceholder)}
                value={sessionName}
                onChange={onChangeName}
              />
            </div>

            <div className="flex-1 mb-2">
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
              className="!mt-2"
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
              className="!mt-2"
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
    </div>
  )
}

SessionCreationForm.defaultProps = defaultProps

export default SessionCreationForm
