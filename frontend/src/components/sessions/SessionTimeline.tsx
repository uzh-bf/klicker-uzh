import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { defineMessages, FormattedMessage } from 'react-intl'
import { Button, Checkbox, Icon, Message, Dropdown, Menu, Modal, Table } from 'semantic-ui-react'
import getConfig from 'next/config'
import _get from 'lodash/get'
import { CSVLink } from 'react-csv'
import { pick } from 'ramda'
import { PlayIcon } from '@heroicons/react/solid'
import { PauseIcon } from '@heroicons/react/outline'
import { StopIcon } from '@heroicons/react/solid'

import durationPlugin from 'dayjs/plugin/duration'

import QuestionBlock from '../questions/QuestionBlock'
import CancelModal from './CancelModal'
import QRPopup from './QRPopup'

dayjs.extend(durationPlugin)

const { publicRuntimeConfig } = getConfig()

const messages = defineMessages({
  buttonCloseBlock: {
    defaultMessage: 'Close current block',
    id: 'runningSession.button.closeBlock',
  },
  buttonFinish: {
    defaultMessage: 'Finish session',
    id: 'runningSession.button.finish',
  },
  buttonOpenBlock: {
    defaultMessage: 'Open next block',
    id: 'runningSession.button.openBlock',
  },
  buttonStart: {
    defaultMessage: 'Open first block',
    id: 'runningSession.button.start',
  },
  togglePublicEvaluation: {
    defaultMessage: 'Publish evaluation',
    id: 'runningSession.button.publicEvaluationToggle',
  },
  toggleParticipantAuthentication: {
    defaultMessage: 'Enforce authentication',
    id: 'runningSession.button.participantAuthenticationToggle',
  },
})

function getMessage(intl, num: number, max: number): any {
  if (num === 0) {
    return {
      icon: 'play',
      label: intl.formatMessage(messages.buttonStart),
    }
  }

  if (num % 2 === 1) {
    return {
      icon: 'right arrow',
      label: intl.formatMessage(messages.buttonCloseBlock),
    }
  }

  if (num === max) {
    return {
      icon: 'stop',
      label: intl.formatMessage(messages.buttonFinish),
    }
  }

  return {
    icon: 'right arrow',
    label: intl.formatMessage(messages.buttonOpenBlock),
  }
}

const calculateRuntime = ({ startedAt }): string => {
  const start = dayjs(startedAt)
  const duration = dayjs.duration(dayjs().diff(start))

  const days = duration.days()
  const hours = `0${duration.hours()}`.slice(-2)
  const minutes = `0${duration.minutes()}`.slice(-2)
  const seconds = `0${duration.seconds()}`.slice(-2)

  if (days > 0) {
    return `${days}d ${hours}:${minutes}:${seconds}`
  }
  return `${hours}:${minutes}:${seconds}`
}

interface Props {
  activeStep: number
  blocks?: any[]
  handleActiveBlock: () => void
  handleNoActiveBlock: () => void
  handleCancelSession: () => void
  handleEndSession: () => void
  handleNextBlock: () => void
  handlePauseSession: () => void
  handleResetQuestionBlock: (instanceIds: string[]) => void
  handleTogglePublicEvaluation: () => void
  handleActivateBlockById: (blockId: number) => void
  handleToggleParticipantList?: () => void
  intl: any
  isParticipantAuthenticationEnabled: boolean
  isEvaluationPublic?: boolean
  isParticipantListVisible: boolean
  participants: any[]
  sessionId: string
  shortname: string
  startedAt?: string
  authenticationMode?: 'PASSWORD' | 'AAI' | 'NONE'
  storageMode?: 'SECRET' | 'COMPLETE'
  subscribeToMore: any
  withQuestionBlockExperiments?: boolean
}

const defaultProps = {
  blocks: [],
  isEvaluationPublic: false,
  isParticipantAuthenticationEnabled: false,
  isParticipantListVisible: false,
  participants: [],
  withQuestionBlockExperiments: false,
}

function SessionTimeline({
  sessionId,
  blocks,
  intl,
  startedAt,
  shortname,
  activeStep,
  participants,
  isEvaluationPublic,
  isParticipantAuthenticationEnabled,
  isParticipantListVisible,
  authenticationMode,
  storageMode,
  handleToggleParticipantList,
  handleNextBlock,
  handleEndSession,
  handlePauseSession,
  handleCancelSession,
  handleTogglePublicEvaluation,
  handleResetQuestionBlock,
  handleActivateBlockById,
  handleActiveBlock,
  handleNoActiveBlock,
  subscribeToMore,
  withQuestionBlockExperiments,
}: Props): React.ReactElement {
  useEffect((): void => {
    subscribeToMore()
  }, [])

  useEffect(() => {
    const isBlockActive = activeStep % 2 === 1
    if (isBlockActive) {
      handleActiveBlock()
    } else {
      handleNoActiveBlock()
    }
  }, [activeStep])

  const isFeedbackSession = blocks.length === 0

  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))

  const startingTime = runtime.includes('d')
    ? dayjs(startedAt).format('DD.MM HH:mm:ss')
    : dayjs(startedAt).format('HH:mm:ss')

  useEffect(() => {
    const currentRuntime = setInterval(() => {
      setRuntime(calculateRuntime({ startedAt }))
    }, 1000)
    return () => clearInterval(currentRuntime)
  }, [runtime])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-row flex-wrap items-end justify-between flex-1 md:flex-auto md:pb-2">
        <div className="flex flex-row flex-wrap items-end">
          <div>
            <Icon name="time" /> {startingTime}
          </div>
          <div className="ml-8">
            <Icon name="play circle" /> {runtime}
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-end mt-1.5 sm:mt-0">
          <div className="flex flex-row flex-wrap w-full sm:w-max">
            <QRPopup shortname={shortname} />
            <a href={`/join/${shortname}`} rel="noopener noreferrer" target="_blank" className="flex flex-1 sm:block">
              <Button icon labelPosition="left" size="small" className="flex flex-1 sm:block">
                <Icon name="external" />
                <FormattedMessage defaultMessage="Student View" id="sessionArea.toJoinSession" values={{ shortname }} />
              </Button>
            </a>
          </div>
          <div className="flex flex-row flex-wrap w-full mt-1 sm:w-max sm:mt-0">
            <a
              href={`/sessions/evaluation/${sessionId}`}
              rel="noopener noreferrer"
              target="_blank"
              className="flex flex-1 sm:block"
            >
              <Button
                icon
                disabled={isFeedbackSession}
                labelPosition="left"
                size="small"
                className="flex flex-1 sm:block"
              >
                <Icon name="external" />
                <FormattedMessage defaultMessage="Evaluation (Results)" id="runningSession.button.evaluation" />
              </Button>
            </a>
            <Dropdown button simple className="icon small" icon="wrench">
              <Dropdown.Menu direction="left">
                <Dropdown.Header>
                  <FormattedMessage defaultMessage="Link for Participants" id="runningSession.string.participantLink" />
                </Dropdown.Header>
                <Dropdown.Item>
                  <a
                    href={`${publicRuntimeConfig.baseUrl}/join/${shortname}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon name="external" />
                    {publicRuntimeConfig.joinUrl
                      ? `${publicRuntimeConfig.joinUrl}/${shortname}`
                      : `${publicRuntimeConfig.baseUrl}/join/${shortname}`}
                  </a>
                </Dropdown.Item>

                <Dropdown.Header>
                  <FormattedMessage defaultMessage="Public Evaluation" id="runningSession.string.publicEvaluation" />
                </Dropdown.Header>
                <Dropdown.Item>
                  <Checkbox
                    checked={isEvaluationPublic}
                    defaultChecked={isEvaluationPublic}
                    label={intl.formatMessage(messages.togglePublicEvaluation)}
                    onChange={handleTogglePublicEvaluation}
                  />
                </Dropdown.Item>
                {isEvaluationPublic && (
                  <Dropdown.Item>
                    <a href={`/sessions/public/${sessionId}`} rel="noopener noreferrer" target="_blank">
                      <Icon name="external" />
                      <FormattedMessage
                        defaultMessage="To Public Evaluation"
                        id="runningSession.button.publicEvaluation"
                      />
                    </a>
                  </Dropdown.Item>
                )}

                {isParticipantAuthenticationEnabled && [
                  <Dropdown.Header key="header">
                    <FormattedMessage
                      defaultMessage="Participant Authentication"
                      id="runningSession.string.participantAuthentication"
                    />
                  </Dropdown.Header>,
                  // <Dropdown.Item>
                  //   <Checkbox
                  //     disabled
                  //     checked={isParticipantAuthenticationEnabled}
                  //     defaultChecked={isParticipantAuthenticationEnabled}
                  //     label={intl.formatMessage(messages.toggleParticipantAuthentication)}
                  //   />
                  // </Dropdown.Item>,
                  <Modal
                    key="modal"
                    open={isParticipantListVisible}
                    trigger={
                      <Menu.Item icon onClick={handleToggleParticipantList}>
                        <Icon name="table" />
                        <FormattedMessage
                          defaultMessage="Participant List"
                          id="runningSession.string.participantList"
                        />
                      </Menu.Item>
                    }
                    onClose={handleToggleParticipantList}
                  >
                    <Modal.Header>
                      <FormattedMessage defaultMessage="Participant List" id="runningSession.string.participantList" />
                    </Modal.Header>
                    <Modal.Content>
                      {authenticationMode === 'AAI' && <Message info>AAI</Message>}

                      <Table celled>
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>
                              <FormattedMessage defaultMessage="Username" id="common.string.username" />
                            </Table.HeaderCell>
                            {authenticationMode === 'PASSWORD' && (
                              <Table.HeaderCell>
                                <FormattedMessage defaultMessage="Password" id="common.string.password" />
                              </Table.HeaderCell>
                            )}
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {participants.map(({ username, password }) => (
                            <Table.Row key={username}>
                              <Table.Cell>{username}</Table.Cell>
                              {authenticationMode === 'PASSWORD' && (
                                <Table.Cell>
                                  <span className="font-serif">{password}</span>
                                </Table.Cell>
                              )}
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </Modal.Content>

                    <Modal.Actions>
                      <CSVLink
                        data={participants.map(pick(['username', authenticationMode === 'PASSWORD' && 'password']))}
                        filename="participants.csv"
                        headers={[
                          { label: 'username', key: 'username' },
                          { label: 'password', key: 'password' },
                        ]}
                      >
                        <Button icon>
                          <Icon name="file" />
                          Download (CSV)
                        </Button>
                      </CSVLink>
                    </Modal.Actions>
                  </Modal>,
                ]}
                {storageMode === 'COMPLETE' && (
                  <Dropdown.Item disabled>
                    <Icon name="download" />
                    <FormattedMessage defaultMessage="Export Responses" id="runningSession.string.downloadResponses" />
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4 overflow-x-auto overflow-y-visible border border-gray-300 border-solid md:flex-grow-0 md:flex-shrink-0 md:flex-row md:p-2 md:flex-00full">
        {blocks.map(
          (block, index): React.ReactElement => (
            <div
              className="flex flex-col items-center blockWrap bg-timeline-mobile md:min-h-[200px] md:flex-row md:!bg-timeline-desktop"
              key={block.id}
            >
              <div
                className={clsx(
                  'my-[0.2rem] mx-0 py-2 px-0 md:my-0 md:mx-[0.2rem] md:py-0 md:px-[0.7rem]',
                  index === 0 && '!mt-0 !pt-0 md:!ml-0 md:!pl-0'
                )}
              >
                {index === 0 ? (
                  <PlayIcon
                    className={clsx(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      index === activeStep / 2 && '!text-green-700'
                    )}
                  />
                ) : (
                  <PauseIcon
                    className={clsx(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      index === activeStep / 2 && '!text-green-700'
                    )}
                  />
                )}
              </div>
              <div className="block w-full flex-grow-1 md:m-1 md:w-[17rem]">
                <QuestionBlock
                  expiresAt={block.expiresAt}
                  handleActivateQuestionBlock={(): void => handleActivateBlockById(block.id)}
                  handleResetQuestionBlock={(): void => handleResetQuestionBlock(block.id)}
                  index={index + 1}
                  questionBlockId={block.id}
                  questions={block.instances.map(({ id, question, version, results }): any => ({
                    id,
                    title: question.title,
                    totalParticipants: index < activeStep / 2 ? _get(results, 'totalParticipants') : -1,
                    type: question.type,
                    version,
                  }))}
                  randomSelection={block.randomSelection}
                  sessionId={sessionId}
                  status={block.status}
                  timeLimit={block.timeLimit}
                  withQuestionBlockExperiments={withQuestionBlockExperiments}
                />
              </div>
              {index === blocks.length - 1 && (
                <div className="my-[0.2rem] mx-0 py-2 px-0 !pb-0 !mb-0 md:!pr-0 md:!mr-0 md:my-0 md:mx-[0.2rem] md:py-0 md:px-[0.7rem]">
                  <StopIcon
                    className={clsx(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      activeStep === blocks.length * 2 && '!text-red-600'
                    )}
                  />
                </div>
              )}
            </div>
          )
        )}
        {isFeedbackSession && (
          <Message info>
            <FormattedMessage
              defaultMessage="This feedback session does not contain any questions."
              id="runningSession.message.feedbackSession"
            />
          </Message>
        )}
      </div>
      <div className="flex flex-col flex-wrap items-start justify-between flex-1 mt-2 sm:flex-row">
        <div className="flex w-full sm:block sm:w-max">
          {!isParticipantAuthenticationEnabled && (
            <Button
              icon
              labelPosition="left"
              size="small"
              className="flex flex-1 sm:block"
              onClick={handlePauseSession}
            >
              <Icon name="pause" />
              <FormattedMessage defaultMessage="Pause Session" id="sessionArea.button.pauseSession" />
            </Button>
          )}
          <CancelModal handleCancelSession={handleCancelSession} />
        </div>

        {isFeedbackSession ? (
          <Button
            // show the session finish button for feedback sessions
            className="!mr-0"
            color="red"
            content={getMessage(intl, 2, 2).label}
            icon={getMessage(intl, 2, 2).icon}
            labelPosition="left"
            onClick={handleEndSession}
          />
        ) : (
          <Button
            // show dynamic buttons for all other sessions
            className="!mr-0 !mt-1.5 !w-full sm:!w-max sm:!mt-0"
            color={activeStep === blocks.length * 2 ? 'red' : 'blue'}
            content={getMessage(intl, activeStep, blocks.length * 2).label}
            icon={getMessage(intl, activeStep, blocks.length * 2).icon}
            labelPosition="left"
            onClick={activeStep >= blocks.length * 2 ? handleEndSession : handleNextBlock}
          />
        )}
      </div>
    </div>
  )
}

SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
