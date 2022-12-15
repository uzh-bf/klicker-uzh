import {
  faClock,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
// import getConfig from 'next/config'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import durationPlugin from 'dayjs/plugin/duration'

import { SessionBlock as SessionBlockType } from '@klicker-uzh/graphql/dist/ops'
import { twMerge } from 'tailwind-merge'
import QRPopup from './cockpit/QRPopup'
import SessionBlock from './cockpit/SessionBlock'

dayjs.extend(durationPlugin)

// const { publicRuntimeConfig } = getConfig()

// function getMessage(num: number, max: number): any {
//   if (num === 0) {
//     return {
//       icon: faPlay,
//       label: 'Ersten Frageblock aktivieren',
//     }
//   }

//   if (num % 2 === 1) {
//     return {
//       icon: faArrowRight,
//       label: 'Aktiven Frageblock schliessen',
//     }
//   }

//   if (num === max) {
//     return {
//       icon: faStop,
//       label: 'Session beenden',
//     }
//   }

//   return {
//     icon: faArrowRight,
//     label: 'Nächsten Frageblock aktivieren',
//   }
// }

const calculateRuntime = ({ startedAt }: { startedAt?: string }): string => {
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
  blocks?: SessionBlockType[]
  handleEndSession: () => void
  handleTogglePublicEvaluation: () => void
  handleOpenBlock: (blockId: number) => void
  handleCloseBlock: (blockId: number) => void
  isEvaluationPublic?: boolean
  sessionId: string
  startedAt?: string
}

const defaultProps = {
  blocks: [],
  isEvaluationPublic: false,
  startedAt: undefined,
}

function SessionTimeline({
  sessionId,
  blocks,
  startedAt,
  isEvaluationPublic,
  handleEndSession,
  handleTogglePublicEvaluation,
  handleOpenBlock,
  handleCloseBlock,
}: Props): React.ReactElement {
  const isFeedbackSession = blocks?.length === 0

  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))

  // logic: keep track of the current and previous block
  const [buttonState, setButtonState] = useState('first block')
  const [activeBlockId, setActiveBlockId] = useState(-1)
  const [lastActiveBlockId, setLastActiveBlockId] = useState(-1)

  const buttonNames = {
    'first block': 'Ersten Block starten',
    'block active': 'Block schliessen',
    'next block': 'Nächsten Block starten',
    'end session': 'Session beenden',
  }

  const startingTime = runtime.includes('d')
    ? dayjs(startedAt).format('DD.MM HH:mm:ss')
    : dayjs(startedAt).format('HH:mm:ss')

  useEffect(() => {
    const currentRuntime = setInterval(() => {
      setRuntime(calculateRuntime({ startedAt }))
    }, 1000)
    return () => clearInterval(currentRuntime)
  }, [runtime, startedAt])

  // basic session timeline logic - identifying the currently active block as well as the state of the session
  useEffect(() => {
    if (blocks) {
      setActiveBlockId(
        blocks.find((block) => block.status === 'ACTIVE')?.id || -1
      )
      if (blocks.every((block) => block.status === 'EXECUTED')) {
        setLastActiveBlockId(blocks[blocks.length - 1].id)
      } else {
        const executedBlockIds = blocks
          .filter((block) => block.status === 'EXECUTED')
          .map((block) => block.id)

        if (executedBlockIds.length === 0) {
          setLastActiveBlockId(-1)
        } else {
          setLastActiveBlockId(executedBlockIds[executedBlockIds.length - 1])
        }
      }

      if (activeBlockId !== -1) {
        // a block is active
        setButtonState('block active')
      } else if (
        // no block is active and last block has been executed
        lastActiveBlockId === blocks[blocks.length - 1].id &&
        activeBlockId === -1
      ) {
        setButtonState('end session')
      } else if (
        // no block is active and no block has been executed yet
        lastActiveBlockId === -1 &&
        activeBlockId === -1
      ) {
        setButtonState('first block')
      } else {
        // no block is active and the last block of the session has not yet been executed
        setButtonState('next block')
      }
    }
  }, [activeBlockId, blocks, lastActiveBlockId])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-row flex-wrap items-end justify-between flex-1 md:flex-auto md:pb-2">
        <div className="flex flex-row flex-wrap items-end">
          <div>
            <FontAwesomeIcon icon={faClock} className="mr-1" /> {startingTime}
          </div>
          <div className="ml-8">
            <FontAwesomeIcon icon={faPlay} className="mr-1" /> {runtime}
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-end mt-1.5 sm:mt-0 gap-2">
          <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max">
            <QRPopup id={sessionId} />
            <a
              className="flex-1"
              href={`https://pwa.klicker.uzh.ch/session/${sessionId}`}
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
            <Link
              passHref
              href={`/sessions/${sessionId}/evaluation`}
              className="flex-1"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button fluid className="h-10" disabled={isFeedbackSession}>
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>Auswertung (Resultate)</Button.Label>
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {!isFeedbackSession && blocks && (
        <>
          <div className="flex flex-row w-full p-4 mt-2 border border-solid rounded-lg border-uzh-grey-80">
            <FontAwesomeIcon
              icon={faPlay}
              size="lg"
              className={twMerge(
                'my-auto p-2 rounded-md',
                buttonState === 'first block' && 'bg-green-300'
              )}
            />
            {blocks.map((block) => (
              <SessionBlock
                key={block.id}
                block={block}
                active={activeBlockId === block.id}
                className="my-auto"
              />
            ))}
            <FontAwesomeIcon
              icon={faStop}
              size="lg"
              className={twMerge(
                'my-auto p-2 rounded-md',
                buttonState === 'end session' && 'bg-uzh-red-100'
              )}
            />
          </div>
          <div className="flex flex-row justify-end w-full mt-2">
            <Button
              className={twMerge(
                (buttonState === 'first block' ||
                  buttonState === 'next block') &&
                  'bg-uzh-blue-100 text-white',
                buttonState === 'end session' && 'bg-uzh-red-100 text-white'
              )}
              onClick={() => {
                if (buttonState === 'first block') {
                  handleOpenBlock(blocks[0].id)
                } else if (buttonState === 'next block') {
                  const openBlockIndex =
                    blocks.findIndex(
                      (block) => block.id === lastActiveBlockId
                    ) + 1
                  handleOpenBlock(blocks[openBlockIndex].id)
                } else if (buttonState === 'block active') {
                  handleCloseBlock(activeBlockId)
                } else {
                  handleEndSession()
                }
              }}
              id="interaction-first-block"
            >
              <Button.Label>{buttonNames[buttonState]}</Button.Label>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
