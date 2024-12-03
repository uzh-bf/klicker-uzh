import { faPauseCircle } from '@fortawesome/free-regular-svg-icons'
import {
  faCode,
  faPlay,
  faStop,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H1 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import EmbeddingModal from '../EmbeddingModal'
import CancelLiveQuizModal from './CancelLiveQuizModal'
import LiveQuizBlock, { QuizTimelineBlock } from './LiveQuizBlock'
import LiveQuizQRModal from './LiveQuizQRModal'
import RuntimeCounter from './RuntimeCounter'

interface LiveQuizTimelineProps {
  blocks?: QuizTimelineBlock[]
  quizName: string
  handleEndLiveQuiz: () => void
  handleTogglePublicEvaluation: () => void
  handleOpenBlock: (blockId: number) => void
  handleCloseBlock: (blockId: number) => void
  isEvaluationPublic?: boolean
  quizId: string
  startedAt?: string
  loading?: boolean
}

function LiveQuizTimeline({
  quizId,
  blocks = [],
  quizName,
  startedAt,
  isEvaluationPublic = false,
  handleEndLiveQuiz,
  handleTogglePublicEvaluation,
  handleOpenBlock,
  handleCloseBlock,
  loading,
}: LiveQuizTimelineProps): React.ReactElement {
  const t = useTranslations()
  const isFeedbackQuiz = blocks?.length === 0
  const { locale } = useRouter()

  const [cancelLiveQuizModal, setCancelLiveQuizModal] = useState(false)
  const [inCooldown, setInCooldown] = useState<boolean>(false)

  // logic: keep track of the current and previous block
  const [buttonState, setButtonState] = useState<
    'firstBlock' | 'blockActive' | 'nextBlock' | 'endQuiz'
  >('firstBlock')
  const [activeBlockId, setActiveBlockId] = useState(-1)
  const [lastActiveBlockId, setLastActiveBlockId] = useState(-1)
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)

  // basic session timeline logic - identifying the currently active block as well as the state of the live quiz
  useEffect(() => {
    if (blocks && blocks.length > 0) {
      setActiveBlockId(
        blocks.find((block) => block.status === 'ACTIVE')?.id ?? -1
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
        setButtonState('endQuiz')
      } else if (
        // no block is active and no block has been executed yet
        lastActiveBlockId === -1 &&
        activeBlockId === -1
      ) {
        setInCooldown(false)
        setButtonState('firstBlock')
      } else {
        // no block is active and the last block of the live quiz has not yet been executed
        setInCooldown(false)
        setButtonState('nextBlock')
      }
    }
  }, [activeBlockId, blocks, lastActiveBlockId])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-1 flex-row flex-wrap items-end justify-between md:flex-auto md:pb-2">
        <div className="flex flex-row flex-wrap items-end gap-8">
          <H1 className={{ root: 'm-0 text-xl' }}>Quiz: {quizName}</H1>
          <RuntimeCounter startedAt={startedAt} />
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
                {t('manage.liveQuizzes.embeddingEvaluation')}
              </Button.Label>
            </Button>
            {!isFeedbackQuiz && (
              <EmbeddingModal
                key={quizId}
                open={embedModalOpen}
                onClose={() => setEmbedModalOpen(false)}
                quizId={quizId}
                elements={blocks.flatMap((block) => block.elements ?? [])}
              />
            )}
            <LiveQuizQRModal quizId={quizId} />
            <a
              className="flex-1"
              href={`${process.env.NEXT_PUBLIC_PWA_URL}/${locale}/session/${quizId}`}
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
              href={`/quizzes/${quizId}/evaluation`}
              className="flex-1"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button
                fluid
                className={{ root: 'h-10' }}
                disabled={isFeedbackQuiz}
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
          {isFeedbackQuiz && (
            <div className="flex w-full flex-row flex-wrap gap-2 sm:mt-0 sm:w-max">
              <Button
                loading={loading}
                className={{
                  root: twMerge('bg-uzh-red-100 h-10 text-white'),
                }}
                onClick={handleEndLiveQuiz}
                data={{ cy: 'end-live-quiz-cockpit' }}
              >
                <Button.Label>{t('manage.cockpit.endQuiz')}</Button.Label>
              </Button>
            </div>
          )}
        </div>
      </div>
      {!isFeedbackQuiz && blocks && (
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
                <LiveQuizBlock
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
                buttonState === 'endQuiz' && 'text-uzh-red-100'
              )}
            />
          </div>
          <div className="mt-2 flex w-full flex-row justify-between gap-2">
            <Button
              onClick={() => setCancelLiveQuizModal(true)}
              className={{ root: 'bg-red-800 text-white' }}
              data={{ cy: 'abort-live-quiz-cockpit' }}
            >
              {t('manage.cockpit.abortLiveQuiz')}
            </Button>
            <Button
              loading={loading}
              className={{
                root: twMerge(
                  (buttonState === 'firstBlock' ||
                    buttonState === 'nextBlock') &&
                    `bg-primary-80 text-white`,
                  buttonState === 'endQuiz' && 'bg-uzh-red-100 text-white',
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
                  handleEndLiveQuiz()
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
          <CancelLiveQuizModal
            open={cancelLiveQuizModal}
            setOpen={setCancelLiveQuizModal}
            quizId={quizId}
            title={quizName}
          />
        </>
      )}
    </div>
  )
}

export default LiveQuizTimeline
