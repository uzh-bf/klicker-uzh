import React, { useState, useEffect } from 'react'
import { v4 as UUIDv4 } from 'uuid'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { Button, Icon, Input } from 'semantic-ui-react'
import { FormattedMessage, defineMessages, useIntl } from 'react-intl'
import { object } from 'yup'
import clsx from 'clsx'
import dayjs from 'dayjs'
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
import CustomButton from '../../common/CustomButton'
import CustomModal from '../../common/CustomModal'
import SessionParticipantSettings, { AuthenticationMode } from './SessionParticipantSettings'

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
  setSessionName: any
  sessionInteractionType?: string
  sessionAuthenticationMode: AuthenticationMode
  handleSetSessionAuthenticationMode: any
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
  setSessionName,
  sessionAuthenticationMode,
  handleSetSessionAuthenticationMode,
}: Props): React.ReactElement {
  const intl = useIntl()
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false)

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

  useEffect(() => {
    setSessionName(dayjs().format('DD.MM.YYYY HH:mm'))
  })

  return (
    <div className="w-full mx-10 md:mx-20 max-w-[100rem] mt-4">
      <DragDropContext onDragEnd={onManageBlocks}>
        <form
          className="flex flex-col md:flex-row w-full border-solid rounded-md ui form border-gray-40 md:h-[16rem]"
          onSubmit={handleCreateSession('save')}
        >
          <div className="flex flex-col flex-1 p-2 overflow-auto md:flex-row">
            {sessionBlocks.map(
              (block, blockIndex): React.ReactElement => (
                <div
                  className="border-0 border-b md:border-b-0 pb-3 md:pb-0 md:border-r border-solid border-grey-60 flex flex-col min-w-[200px] w-full md:max-w-[200px]"
                  key={block.id}
                >
                  <div className="flex flex-row justify-between font-bold text-center align-center pt-0 pr-2 pb-[0.3rem] pl-2">
                    <div className="pt-3 md:pt-0.5">
                      {`Block ${blockIndex + 1}`} {`(${block.questions.length})`}
                    </div>
                    <div className="hidden md:block">
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
                  <div className="flex flex-row h-full">
                    <div className="flex flex-col flex-1 h-full max-h-[12.5rem]">
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
                      <div className="flex-[0_0_2rem] mt-4 my-0 mx-[0.5rem]">
                        <QuestionDropzone
                          onDrop={(question): void => {
                            onExtendBlock(block.id, { ...question, type: question.questionType })
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col md:hidden">
                      <Button
                        basic
                        className="!p-2 !mr-0 !border-0 !shadow-none"
                        icon="arrow up"
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
                        icon="arrow down"
                        size="mini"
                        type="button"
                        onClick={(): void => onReorderBlocks(blockIndex, blockIndex + 1)}
                      />
                    </div>
                  </div>
                </div>
              )
            )}
            <div
              className={clsx(
                'border-0 border-b md:border-b-0 pb-4 md:pb-0 md:border-r border-solid border-grey-60 flex flex-col min-w-[200px] max-h-[15rem]',
                sessionBlocks.length > 1 && 'border-b-0'
              )}
            >
              <div className="flex justify-between font-bold text-center align-center pt-3 md:pt-0.5 pr-2 pb-[0.3rem] pl-2 max-h-[10rem] md:min-h-[10rem]">
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
              <div className="flex-[0_0_2rem] my-0 mx-[0.5rem]">
                <QuestionDropzone
                  onDrop={(question): void => {
                    onNewBlock({ ...question, type: question.questionType })
                  }}
                />
              </div>
            </div>
            {sessionBlocks.length <= 1 && <InfoArea />}
          </div>

          <div className="flex-[0_0_17rem] p-4 pt-0 border-0 border-t md:border-t-0 md:border-l border-solid border-grey-60 flex flex-col">
            <div className="flex-1 mt-2 mb-2">
              <Input
                className="!mr-0 w-full"
                name="sessionName"
                placeholder={intl.formatMessage(messages.sessionNamePlaceholder)}
                value={sessionName}
                onChange={onChangeName}
              />
            </div>

            <CustomButton type="button" onClick={() => setSettingsModalOpen(true)}>
              <Icon className="!mr-4" name="settings" />
              <FormattedMessage defaultMessage="Settings" id="common.button.settings" />
            </CustomButton>

            <CustomModal
              discardEnabled={!isAuthenticationEnabled || sessionParticipants.length !== 0}
              escapeEnabled={!isAuthenticationEnabled || sessionParticipants.length !== 0}
              open={isSettingsModalOpen}
              onDiscard={() => setSettingsModalOpen(false)}
            >
              <div className="mb-2 text-xl font-bold">Session Settings</div>
              <SessionParticipantSettings
                authenticationMode={sessionAuthenticationMode}
                isAuthenticationEnabled={isAuthenticationEnabled}
                participants={sessionParticipants}
                onChangeAuthenticationMode={handleSetSessionAuthenticationMode}
                onChangeIsAuthenticationEnabled={handleSetIsAuthenticationEnabled}
                onChangeParticipants={handleSetSessionParticipants}
              />
            </CustomModal>

            <CustomButton
              className="!mt-2"
              disabled={!isValid || (isAuthenticationEnabled && sessionParticipants.length === 0)}
              type="submit"
              onClick={() => null}
            >
              <Icon className="!mr-4" name="save" />
              <FormattedMessage defaultMessage="Save Session" id="form.createSession.button.save" />
            </CustomButton>

            <CustomButton
              className={clsx(
                '!mt-2  text-white bg-sky-600 opacity-60',
                !(!isValid || !!runningSessionId || (isAuthenticationEnabled && sessionParticipants.length === 0)) &&
                  'hover:bg-sky-700 !opacity-100'
              )}
              disabled={!isValid || !!runningSessionId || (isAuthenticationEnabled && sessionParticipants.length === 0)}
              type="submit"
              onClick={handleCreateSession('start')}
            >
              <Icon className="!mr-4" name="play" />
              <FormattedMessage defaultMessage="Start Now" id="form.createSession.button.start" />
            </CustomButton>

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
