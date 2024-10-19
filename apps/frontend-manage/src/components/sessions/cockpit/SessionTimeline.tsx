import { faPauseCircle } from '@fortawesome/free-regular-svg-icons'
import {
  faClock,
  faCode,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SessionBlock as ISessionBlock } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import durationPlugin from 'dayjs/plugin/duration'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import EmbeddingModal from '../EmbeddingModal'
import CancelSessionModal from './CancelSessionModal'
import SessionBlock from './SessionBlock'
import SessionQRModal from './SessionQRModal'

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

interface SessionTimelineProps {
  blocks?: ISessionBlock[]
  sessionName: string
  handleEndSession: () => void
  handleTogglePublicEvaluation: () => void
  handleOpenBlock: (blockId: number) => void
  handleCloseBlock: (blockId: number) => void
  isEvaluationPublic?: boolean
  sessionId: string
  startedAt?: string
  loading?: boolean
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
  loading,
}: SessionTimelineProps): React.ReactElement {
  const t = useTranslations()
  const isFeedbackSession = blocks?.length === 0
  const { locale } = useRouter()

  const [cancelSessionModal, setCancelSessionModal] = useState(false)
  const [inCooldown, setInCooldown] = useState<boolean>(false)
  const [runtime, setRuntime] = useState(calculateRuntime({ startedAt }))

  // logic: keep track of the current and previous block
  const [buttonState, setButtonState] = useState<
    'firstBlock' | 'blockActive' | 'nextBlock' | 'endSession'
  >('firstBlock')
  const [activeBlockId, setActiveBlockId] = useState(-1)
  const [lastActiveBlockId, setLastActiveBlockId] = useState(-1)
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)

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
        setInCooldown(false)
        setButtonState('endSession')
      } else if (
        // no block is active and no block has been executed yet
        lastActiveBlockId === -1 &&
        activeBlockId === -1
      ) {
        setInCooldown(false)
        setButtonState('firstBlock')
      } else {
        // no block is active and the last block of the session has not yet been executed
        setInCooldown(false)
        setButtonState('nextBlock')
      }
    }
  }, [activeBlockId, blocks, lastActiveBlockId])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-1 flex-row flex-wrap items-end justify-between md:flex-auto md:pb-2">
        <div className="flex flex-row flex-wrap items-end gap-8">
          <H1 className={{ root: 'm-0 text-xl' }}>Quiz: {sessionName}</H1>
          <div>
            <FontAwesomeIcon icon={faClock} className="mr-1" /> {startingTime}
          </div>
          <div>
            <FontAwesomeIcon icon={faPlay} className="mr-1" /> {runtime}
          </div>
        </div>

        <div className="mt-1.5 flex flex-row flex-wrap items-end gap-2 sm:mt-0">
          <div className="flex w-full flex-row flex-wrap gap-2 sm:w-max">
            <Button
              onClick={() => setEmbedModalOpen(true)}
              className={{ root: 'h-10' }}
              data={{ cy: 'embed-evaluation-cockpit' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faCode} size="sm" />
              </Button.Icon>
              <Button.Label>
                {t('manage.sessions.embeddingEvaluation')}
              </Button.Label>
            </Button>
            {!isFeedbackSession && (
              <EmbeddingModal
                key={sessionId}
                open={embedModalOpen}
                onClose={() => setEmbedModalOpen(false)}
                sessionId={sessionId}
                questions={blocks.flatMap((block) => block.instances ?? [])}
              />
            )}
            <SessionQRModal sessionId={sessionId} />
            <a
              className="flex-1"
              href={`${process.env.NEXT_PUBLIC_PWA_URL}/${locale}/session/${sessionId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button
                fluid
                className={{ root: 'h-10' }}
                data={{ cy: 'audience-view-cockpit' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faUpRightFromSquare} />
                </Button.Icon>
                <Button.Label>{t('manage.cockpit.audienceView')}</Button.Label>
              </Button>
            </a>
          </div>
          <div className="flex w-full flex-row flex-wrap gap-2 sm:mt-0 sm:w-max">
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
                data={{ cy: 'evaluation-results-cockpit' }}
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
            <div className="flex w-full flex-row flex-wrap gap-2 sm:mt-0 sm:w-max">
              <Button
                loading={loading}
                className={{
                  root: twMerge('bg-uzh-red-100 h-10 text-white'),
                }}
                onClick={handleEndSession}
                data={{ cy: 'end-session-cockpit' }}
              >
                <Button.Label>{t('manage.cockpit.endSession')}</Button.Label>
              </Button>
            </div>
          )}
        </div>
      </div>
      {!isFeedbackSession && blocks && (
        <>
          <div className="border-uzh-grey-80 mt-2 flex w-full flex-row gap-2 overflow-auto rounded-lg border border-solid p-4 md:mt-0">
            <FontAwesomeIcon
              icon={faPlay}
              size="xl"
              className={twMerge(
                'my-auto rounded-md p-2',
                buttonState === 'firstBlock' && 'text-green-500'
              )}
            />
            {blocks.map((block, idx) => (
              <>
                <SessionBlock
                  key={`${block.id}-${block.status}`}
                  block={block}
                  inCooldown={inCooldown && activeBlockId === block.id}
                  setInCooldown={setInCooldown}
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
                'my-auto rounded-md p-2',
                buttonState === 'endSession' && 'text-uzh-red-100'
              )}
            />
          </div>
          <div className="mt-2 flex w-full flex-row justify-between gap-2">
            <Button
              onClick={() => setCancelSessionModal(true)}
              className={{ root: 'bg-red-800 text-white' }}
              data={{ cy: 'abort-session-cockpit' }}
            >
              {t('manage.cockpit.abortSession')}
            </Button>
            <Button
              loading={loading}
              className={{
                root: twMerge(
                  (buttonState === 'firstBlock' ||
                    buttonState === 'nextBlock') &&
                    `bg-primary-80 text-white`,
                  buttonState === 'endSession' && 'bg-uzh-red-100 text-white',
                  buttonState === 'blockActive' &&
                    inCooldown &&
                    'text-uzh-red-100 border-uzh-red-100'
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
                  setInCooldown(false)
                } else {
                  handleEndSession()
                }
              }}
              data={{ cy: 'next-block-timeline' }}
            >
              <Button.Label>
                {buttonState === 'blockActive' && inCooldown
                  ? t('manage.cockpit.skipCooldown')
                  : t(`manage.cockpit.${buttonState}`)}
              </Button.Label>
            </Button>
          </div>
          <CancelSessionModal
            open={cancelSessionModal}
            setOpen={setCancelSessionModal}
            sessionId={sessionId}
            title={sessionName}
          />
        </>
      )}
    </div>
  )
}

export default SessionTimeline
