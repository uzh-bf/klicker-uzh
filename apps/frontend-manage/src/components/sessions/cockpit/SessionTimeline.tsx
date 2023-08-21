import {
  faClock,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import durationPlugin from 'dayjs/plugin/duration'

import { faPauseCircle } from '@fortawesome/free-regular-svg-icons'
import { SessionBlock as ISessionBlock } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CancelSessionModal from './CancelSessionModal'
import QRPopup from './QRPopup'
import SessionBlock from './SessionBlock'

dayjs.extend(durationPlugin)

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
  blocks?: ISessionBlock[]
  sessionName: string
  handleEndSession: () => void
  handleTogglePublicEvaluation: () => void
  handleOpenBlock: (blockId: number) => void
  handleCloseBlock: (blockId: number) => void
  isEvaluationPublic?: boolean
  sessionId: string
  startedAt?: string
}

function SessionTimeline({
  sessionId,
  blocks = [],
  sessionName,
  startedAt,
  isEvaluationPublic = false,
  handleEndSession,
  handleTogglePublicEvaluation,
  handleOpenBlock,
  handleCloseBlock,
}: Props): React.ReactElement {
  const t = useTranslations()
  const isFeedbackSession = blocks?.length === 0

  const [cancelSessionModal, setCancelSessionModal] = useState(false)
  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))

  // logic: keep track of the current and previous block
  const [buttonState, setButtonState] = useState<
    'firstBlock' | 'blockActive' | 'nextBlock' | 'endSession'
  >('firstBlock')
  const [activeBlockId, setActiveBlockId] = useState(-1)
  const [lastActiveBlockId, setLastActiveBlockId] = useState(-1)

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
    if (blocks && blocks.length > 0) {
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
        setButtonState('blockActive')
      } else if (
        // no block is active and last block has been executed
        lastActiveBlockId === blocks[blocks.length - 1].id &&
        activeBlockId === -1
      ) {
        setButtonState('endSession')
      } else if (
        // no block is active and no block has been executed yet
        lastActiveBlockId === -1 &&
        activeBlockId === -1
      ) {
        setButtonState('firstBlock')
      } else {
        // no block is active and the last block of the session has not yet been executed
        setButtonState('nextBlock')
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
            <QRPopup
              link={`${process.env.NEXT_PUBLIC_PWA_URL}/session/${sessionId}`}
              relativeLink={`/session/${sessionId}`}
            />
            <a
              className="flex-1"
              href={`${process.env.NEXT_PUBLIC_PWA_URL}/session/${sessionId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button fluid className={{ root: 'h-10' }}>
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>{t('manage.cockpit.audienceView')}</Button.Label>
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
              <Button
                fluid
                className={{ root: 'h-10' }}
                disabled={isFeedbackSession}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>
                  {t('manage.cockpit.evaluationResults')}
                </Button.Label>
              </Button>
            </Link>
          </div>
          {isFeedbackSession && (
            <div className="flex flex-row flex-wrap w-full gap-2 sm:w-max sm:mt-0">
              <Button
                className={{
                  root: twMerge('bg-uzh-red-100 text-white h-10'),
                }}
                onClick={handleEndSession}
              >
                <Button.Label>{buttonNames['endSession']}</Button.Label>
              </Button>
            </div>
          )}
        </div>
      </div>
      {!isFeedbackSession && blocks && (
        <>
          <div className="flex flex-row w-full gap-2 p-4 mt-2 overflow-scroll border border-solid rounded-lg border-uzh-grey-80">
            <FontAwesomeIcon
              icon={faPlay}
              size="xl"
              className={twMerge(
                'my-auto p-2 rounded-md',
                buttonState === 'firstBlock' && 'text-green-500'
              )}
            />
            {blocks.map((block, idx) => (
              <>
                <SessionBlock
                  key={block.id}
                  block={block}
                  active={activeBlockId === block.id}
                  className="my-auto"
                />
                <FontAwesomeIcon
                  className={twMerge(
                    'my-auto',
                    idx === blocks.length - 1 && 'hidden',
                    buttonState === 'nextBlock' &&
                      lastActiveBlockId === block.id &&
                      'text-green-500'
                  )}
                  icon={faPauseCircle}
                  size="xl"
                />
              </>
            ))}
            <FontAwesomeIcon
              icon={faStop}
              size="xl"
              className={twMerge(
                'my-auto p-2 rounded-md',
                buttonState === 'endSession' && 'text-uzh-red-100'
              )}
            />
          </div>
          <div className="flex flex-row justify-end w-full gap-2 mt-2">
            <Button
              onClick={() => setCancelSessionModal(true)}
              className={{ root: 'bg-red-800 text-white' }}
            >
              {t('manage.cockpit.abortSession')}
            </Button>
            <Button
              className={{
                root: twMerge(
                  (buttonState === 'firstBlock' ||
                    buttonState === 'nextBlock') &&
                    `text-white bg-primary-80`,
                  buttonState === 'endSession' && 'bg-uzh-red-100 text-white'
                ),
              }}
              onClick={() => {
                if (buttonState === 'firstBlock') {
                  handleOpenBlock(blocks[0].id)
                } else if (buttonState === 'nextBlock') {
                  const openBlockIndex =
                    blocks.findIndex(
                      (block) => block.id === lastActiveBlockId
                    ) + 1
                  handleOpenBlock(blocks[openBlockIndex].id)
                } else if (buttonState === 'blockActive') {
                  handleCloseBlock(activeBlockId)
                } else {
                  handleEndSession()
                }
              }}
              data={{ cy: 'interaction-first-block' }}
            >
              <Button.Label>{t(`manage.cockpit.${buttonState}`)}</Button.Label>
            </Button>
          </div>
          <CancelSessionModal
            isDeletionModalOpen={cancelSessionModal}
            setIsDeletionModalOpen={setCancelSessionModal}
            sessionId={sessionId}
            title={sessionName}
          />
        </>
      )}
    </div>
  )
}

export default SessionTimeline
