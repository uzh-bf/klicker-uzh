import {
  faArrowRight,
  faPause,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import getConfig from 'next/config'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
// import { CSVLink } from 'react-csv'

import durationPlugin from 'dayjs/plugin/duration'

import { SessionBlock } from '@klicker-uzh/graphql/dist/ops'
import CancelModal from './CancelModal'
import QRPopup from './QRPopup'

dayjs.extend(durationPlugin)

const { publicRuntimeConfig } = getConfig()

function getMessage(num: number, max: number): any {
  if (num === 0) {
    return {
      icon: faPlay,
      label: 'Ersten Frageblock aktivieren',
    }
  }

  if (num % 2 === 1) {
    return {
      icon: faArrowRight,
      label: 'Aktiven Frageblock schliessen',
    }
  }

  if (num === max) {
    return {
      icon: faStop,
      label: 'Session beenden',
    }
  }

  return {
    icon: faArrowRight,
    label: 'Nächsten Frageblock aktivieren',
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
  activeBlock?: SessionBlock
  blocks?: SessionBlock[]
  handleActiveBlock: () => void
  handleNoActiveBlock: () => void
  handleCancelSession: () => void
  handleEndSession: () => void
  handleNextBlock: () => void
  handlePauseSession: () => void
  handleResetQuestionBlock: (instanceIds: string[]) => void
  handleTogglePublicEvaluation: () => void
  handleActivateBlockById: (blockId: number) => void
  // handleToggleParticipantList?: () => void
  // isParticipantAuthenticationEnabled: boolean
  isEvaluationPublic?: boolean
  // isParticipantListVisible: boolean
  // participants: any[]
  sessionId: string
  shortname: string
  startedAt?: string
  // authenticationMode?: 'PASSWORD' | 'AAI' | 'NONE'
  // storageMode?: 'SECRET' | 'COMPLETE'
  // TODO: readd subscriptions
  // subscribeToMore: any
  // withQuestionBlockExperiments?: boolean
}

const defaultProps = {
  blocks: [],
  isEvaluationPublic: false,
  activeBlock: undefined,
  // isParticipantAuthenticationEnabled: false,
  // isParticipantListVisible: false,
  // participants: [],
  // withQuestionBlockExperiments: false,
}

function SessionTimeline({
  sessionId,
  blocks,
  startedAt,
  // participants,
  isEvaluationPublic,
  // isParticipantAuthenticationEnabled,
  // isParticipantListVisible,
  // authenticationMode,
  // storageMode,
  activeBlock,
  // handleToggleParticipantList,
  handleNextBlock,
  handleEndSession,
  handlePauseSession,
  handleCancelSession,
  handleTogglePublicEvaluation,
  handleResetQuestionBlock,
  handleActivateBlockById,
  handleActiveBlock,
  handleNoActiveBlock,
}: // subscribeToMore,
// withQuestionBlockExperiments,
Props): React.ReactElement {
  // useEffect((): void => {
  //   subscribeToMore()
  // }, [])

  useEffect(() => {
    // TODO: fix logic based on activeblock id
    const isBlockActive = true
  }, [])
  //   activeStep % 2 === 1
  //   if (isBlockActive) {
  //     handleActiveBlock()
  //   } else {
  //     handleNoActiveBlock()
  //   }
  // }, [activeStep])

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
          <div>// TODO: IC TIME {startingTime}</div>
          <div className="ml-8">// TODO: IC play circle {runtime}</div>
        </div>

        <div className="flex flex-row flex-wrap items-end mt-1.5 sm:mt-0 gap-2">
          <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max">
            <QRPopup id={sessionId} />
            <a
              className="flex-1"
              href={`/join/${sessionId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button fluid className="h-10">
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>Publikumsansicht</Button.Label>
              </Button>
            </a>
          </div>
          <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max sm:mt-0">
            <Link passHref prefetch href={`/sessions/evaluation/${sessionId}`}>
              <a className="flex-1" rel="noopener noreferrer" target="_blank">
                <Button fluid className="h-10" disabled={isFeedbackSession}>
                  <Button.Icon>
                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                  </Button.Icon>
                  <Button.Label>Auswertung (Resultate)</Button.Label>
                </Button>
              </a>
            </Link>
            {/* // TODO: fix publish evaluation dropdown
             <Dropdown button simple className="icon small !mr-0" icon="wrench">
              <Dropdown.Menu direction="left">
                <Dropdown.Header>Link für Teilnehmende</Dropdown.Header>
                <Dropdown.Item>
                  <a
                    href={`${publicRuntimeConfig.baseUrl}/join/${shortname}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                    {publicRuntimeConfig.joinUrl
                      ? `${publicRuntimeConfig.joinUrl}/${shortname}`
                      : `${publicRuntimeConfig.baseUrl}/join/${shortname}`}
                  </a>
                </Dropdown.Item>

                <Dropdown.Header>Öffentliche Auswertung</Dropdown.Header>
                <Dropdown.Item>
                  <Checkbox
                    checked={isEvaluationPublic}
                    defaultChecked={isEvaluationPublic}
                    label="Auswertung publizieren"
                    onChange={handleTogglePublicEvaluation}
                  />
                </Dropdown.Item>
                {isEvaluationPublic && (
                  <Dropdown.Item>
                    <a
                      href={`/sessions/public/${sessionId}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <FontAwesomeIcon icon={faUpRightFromSquare} />
                      Zur öffentlichen Auswertung
                    </a>
                  </Dropdown.Item>
                )} */}

            {/* // TODO: readd participant authentication
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
                  //     label="Authentifizierung erzwingen"
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
                        <Button className="h-10 px-3">
                          <Button.Icon>
                            <FontAwesomeIcon icon={faFile} />
                          </Button.Icon>
                          <Button.Label>Download (CSV)</Button.Label>
                        </Button>
                      </CSVLink>
                    </Modal.Actions>
                  </Modal>,
                ]} */}
            {/* {storageMode === 'COMPLETE' && (
                  <Dropdown.Item disabled>
                    <Icon name="download" />
                    <FormattedMessage defaultMessage="Export Responses" id="runningSession.string.downloadResponses" />
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
                </Dropdown> */}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4 mt-2 overflow-x-auto overflow-y-visible border border-gray-300 border-solid md:mt-0 md:flex-grow-0 md:flex-shrink-0 md:flex-row md:p-2 md:flex-[0_0_100%]">
        Session Timeline
        {/* {blocks.map(
          (activeBlock): React.ReactElement => (
            <div
              className="flex flex-col items-center blockWrap bg-timeline-mobile md:min-h-[200px] md:flex-row md:!bg-timeline-desktop"
              key={activeBlock.id}
            >
              <div
                className={twMerge(
                  'my-[0.2rem] mx-0 py-2 px-0 md:my-0 md:mx-[0.2rem] md:py-0 md:px-[0.7rem]',
                  index === 0 && '!mt-0 !pt-0 md:!ml-0 md:!pl-0'
                )}
              >
                {index === 0 ? (
                  <FontAwesomeIcon
                    icon={faPlay}
                    className={twMerge(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      index === activeStep / 2 && '!text-green-700'
                    )}
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faPause}
                    className={twMerge(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      index === activeStep / 2 && '!text-green-700'
                    )}
                  />
                )}
              </div>
              <div className="block w-full flex-grow-1 md:m-1 md:w-[17rem]">
                <QuestionBlock
                  expiresAt={activeBlock.expiresAt}
                  handleActivateQuestionBlock={(): void =>
                    handleActivateBlockById(activeBlock.id)
                  }
                  handleResetQuestionBlock={(): void =>
                    handleResetQuestionBlock(activeBlock.id)
                  }
                  index={index + 1}
                  questionBlockId={activeBlock.id}
                  questions={activeBlock.instances.map(
                    ({ id, question, version, results }): any => ({
                      id,
                      title: question.title,
                      totalParticipants:
                        index < activeStep / 2
                          ? _get(results, 'totalParticipants')
                          : -1,
                      type: question.type,
                      version,
                    })
                  )}
                  // randomSelection={block.randomSelection}
                  sessionId={sessionId}
                  status={activeBlock.status}
                  timeLimit={activeBlock.timeLimit}
                  // withQuestionBlockExperiments={withQuestionBlockExperiments}
                />
              </div>
              {index === activeBlock.length - 1 && (
                <div className="my-[0.2rem] mx-0 py-2 px-0 !pb-0 !mb-0 md:!pr-0 md:!mr-0 md:my-0 md:mx-[0.2rem] md:py-0 md:px-[0.7rem]">
                  <FontAwesomeIcon
                    icon={faStop}
                    className={twMerge(
                      'h-10 -mb-1.5 bg-white text-grey-40',
                      activeStep === activeBlock.length * 2 && '!text-red-600'
                    )}
                  />
                </div>
              )}
            </div>)
          )} */}
        {isFeedbackSession && (
          <div>
            // TODO: message styling Diese Session ist eine Feedback-Session
            (ohne Fragen, nur für Confusion-Barometer/Feedbacks).
          </div>
        )}
      </div>
      <div className="flex flex-col flex-wrap items-start justify-between flex-1 gap-2 mt-2 sm:flex-row">
        <div className="flex flex-row items-start w-full gap-2 sm:w-max">
          {/* // TODO: replace true by !isParticipantAuthenticationEnabled */}
          {true && (
            <Button
              className="justify-center flex-1 h-10 px-4 sm:flex-initial"
              onClick={handlePauseSession}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPause} size="lg" />
              </Button.Icon>
              <Button.Label>Session pausieren</Button.Label>
            </Button>
          )}
          <CancelModal handleCancelSession={handleCancelSession} />
        </div>

        {isFeedbackSession ? (
          <Button
            // show the session finish button for feedback sessions
            className="h-10 bg-uzh-red-60"
            onClick={handleEndSession}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={getMessage( 2, 2).icon} size="lg" />
            </Button.Icon>
            <Button.Label>{getMessage( 2, 2).label}</Button.Label>
          </Button>
        ) : (
          <Button
            // show dynamic buttons for all other sessions
            className="justify-center w-full h-10 px-4 font-bold text-white sm:w-max bg-uzh-blue-80 disabled:opacity-60"
            // onClick={
            //   activeStep >= blocks.length * 2
            //     ? handleEndSession
            //     : handleNextBlock
            // }
          >
            <Button.Icon>
              <FontAwesomeIcon
              // TODO: replace argument 1 with activeStep
                icon={getMessage(0, blocks.length * 2).icon}
                size="lg"
              />
            </Button.Icon>
            <Button.Label>
              {getMessage(0, blocks.length * 2).label}
            </Button.Label>
          </Button>
        )}
      </div>
    </div>
  )
}

SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
