import { faPauseCircle } from '@fortawesome/free-regular-svg-icons'
import {
  faCode,
  faFastForward,
  faFlagCheckered,
  faPlay,
  faQrcode,
  faStop,
  faUpRightFromSquare,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LocaleType } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H4, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import EmbeddingModal from '../EmbeddingModal'
import CancelLiveQuizModal from './CancelLiveQuizModal'
import CloseBlockConfirmDialog from './CloseBlockConfirmDialog'
import LiveQuizBlock, { QuizTimelineBlock } from './LiveQuizBlock'
import LiveQuizQRModal from './LiveQuizQRModal'
import RuntimeCounter from './RuntimeCounter'

interface LiveQuizTimelineProps {
  assessmentMode: boolean
  quizId: string
  quizName: string
  quizDisplayName: string
  quizPin?: string | null
  blocks?: QuizTimelineBlock[]
  language?: LocaleType | null
  isGamificationEnabled: boolean
  handleEndLiveQuiz: () => Promise<void>
  handleOpenBlock: (blockId: number) => Promise<void>
  handleCloseBlock: (blockId: number) => Promise<void>
  startedAt?: string
  loading?: boolean
}

function LiveQuizTimeline({
  assessmentMode,
  quizId,
  quizName,
  quizDisplayName,
  quizPin,
  blocks = [],
  language,
  startedAt,
  isGamificationEnabled,
  handleEndLiveQuiz,
  handleOpenBlock,
  handleCloseBlock,
  loading,
}: LiveQuizTimelineProps): React.ReactElement {
  const t = useTranslations()
  const isFeedbackQuiz = blocks?.length === 0
  const { locale } = useRouter()

  const [cancelLiveQuizModal, setCancelLiveQuizModal] = useState(false)
  const [qrModal, setQRModal] = useState(false)
  const [inCooldown, setInCooldown] = useState<boolean>(false)
  const [confirmBlockClosure, setConfirmBlockClosure] = useState(false)

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
        setButtonState('endQuiz')
      } else if (
        // no block is active and no block has been executed yet
        lastActiveBlockId === -1 &&
        activeBlockId === -1
      ) {
        setButtonState('firstBlock')
      } else {
        // no block is active and the last block of the live quiz has not yet been executed
        setButtonState('nextBlock')
      }
    }
  }, [activeBlockId, blocks, lastActiveBlockId])

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap">
      <div className="flex flex-1 flex-col items-center gap-y-2 pb-3 md:flex-wrap lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col flex-wrap items-center text-center lg:items-start lg:text-left">
          <H1>Quiz: {quizName}</H1>
          <H4 data={{ cy: 'live-quiz-display-name' }}>
            {t('manage.activityWizard.displayName')}: {quizDisplayName}
          </H4>
        </div>

        <div className="flex flex-1 flex-col flex-wrap items-center justify-center gap-y-2 text-xl">
          {quizPin && (
            <span
              className="text-uzh-red-100 -mb-0.5 h-max flex-1 font-bold"
              data-cy="live-quiz-pin"
            >
              <span>{t('shared.generic.pin')}: </span>
              <span className="inline-flex gap-1">
                <span>{quizPin.slice(0, 3)}</span>
                <span>{quizPin.slice(3)}</span>
              </span>
            </span>
          )}
          <div className="flex flex-1 gap-8">
            <RuntimeCounter startedAt={startedAt} />
          </div>
        </div>

        <div className="flex flex-1 flex-row flex-wrap justify-end gap-2">
          <div
            className={twMerge(
              'justify-center gap-2 sm:w-max sm:justify-end',
              assessmentMode
                ? 'flex flex-1 flex-row flex-wrap'
                : 'grid grid-cols-2'
            )}
          >
            <Button
              onClick={() => setEmbedModalOpen(true)}
              disabled={isFeedbackQuiz}
              className={{ root: 'h-8' }}
              data={{ cy: 'embed-evaluation-cockpit' }}
            >
              <Button.Icon icon={faCode} />
              <Button.Label>
                {t('manage.liveQuizzes.embeddingEvaluation')}
              </Button.Label>
            </Button>
            <Button
              className={{ root: 'h-8' }}
              onClick={() => setQRModal(true)}
              data={{ cy: 'open-qr-modal' }}
            >
              <Button.Icon icon={faQrcode} />
              <Button.Label> {t('manage.general.qrCode')}</Button.Label>
            </Button>
            {/* // TODO: allow owners to access live quiz, but reject / ignore responses in response-api */}
            {!assessmentMode && (
              <a
                className="flex-1"
                href={`${assessmentMode ? process.env.NEXT_PUBLIC_ASSESSMENT_URL : process.env.NEXT_PUBLIC_PWA_URL}/${locale}/session/${quizId}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Button
                  fluid
                  className={{ root: 'h-8' }}
                  data={{ cy: 'audience-view-cockpit' }}
                >
                  <Button.Icon icon={faUpRightFromSquare} />
                  <Button.Label>
                    {t('manage.cockpit.audienceView')}
                  </Button.Label>
                </Button>
              </a>
            )}
            <Link
              passHref
              href={`/quizzes/${quizId}/evaluation`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button
                fluid
                className={{ root: 'h-8' }}
                disabled={isFeedbackQuiz}
                data={{ cy: 'evaluation-results-cockpit' }}
              >
                <Button.Icon icon={faUpRightFromSquare} />
                <Button.Label>
                  {t('manage.cockpit.evaluationResults')}
                </Button.Label>
              </Button>
            </Link>
          </div>

          {isFeedbackQuiz && (
            <div className="flex w-full flex-row flex-wrap gap-2 sm:mt-0 sm:w-max">
              <Button
                primary
                disabled={loading}
                className={{
                  root: twMerge(
                    'bg-uzh-red-100 hover:bg-uzh-red-100 h-8 text-white'
                  ),
                }}
                onClick={async () => await handleEndLiveQuiz()}
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
                  active={activeBlockId === block.id}
                  setBlockClosureModal={setConfirmBlockClosure}
                  className="my-auto"
                />
                <FontAwesomeIcon
                  className={twMerge(
                    'my-auto',
                    idx === blocks.length - 1 && 'hidden!',
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
            {/* assessment quizzes can only be aborted before starting the first block */}
            {assessmentMode &&
            !(lastActiveBlockId === -1 && activeBlockId === -1) ? (
              <Tooltip tooltip={t('manage.cockpit.noAbortionAssessmentQuiz')}>
                <Button
                  destructive
                  disabled
                  data={{ cy: 'abort-live-quiz-cockpit' }}
                  className={{ root: 'h-8' }}
                >
                  <Button.Icon icon={faStop} />
                  <Button.Label>
                    {t('manage.cockpit.abortLiveQuiz')}
                  </Button.Label>
                </Button>
              </Tooltip>
            ) : (
              <Button
                destructive
                onClick={() => setCancelLiveQuizModal(true)}
                data={{ cy: 'abort-live-quiz-cockpit' }}
                className={{ root: 'h-8' }}
              >
                <Button.Icon icon={faX} />
                <Button.Label>{t('manage.cockpit.abortLiveQuiz')}</Button.Label>
              </Button>
            )}
            <Button
              primary={
                buttonState === 'firstBlock' ||
                buttonState === 'nextBlock' ||
                buttonState === 'endQuiz'
              }
              disabled={loading}
              className={{
                root: twMerge(
                  'h-8',
                  buttonState === 'endQuiz' &&
                    'bg-uzh-red-100 hover:bg-uzh-red-100',
                  buttonState === 'blockActive' &&
                    inCooldown &&
                    'text-uzh-red-100 border-uzh-red-100 border bg-white'
                ),
              }}
              onClick={async () => {
                if (buttonState === 'firstBlock') {
                  await handleOpenBlock(blocks[0].id)
                } else if (buttonState === 'nextBlock') {
                  const openBlockIndex =
                    blocks.findIndex(
                      (block) => block.id === lastActiveBlockId
                    ) + 1
                  await handleOpenBlock(blocks[openBlockIndex].id)
                } else if (buttonState === 'blockActive') {
                  if (assessmentMode) {
                    setConfirmBlockClosure(true)
                  } else {
                    await handleCloseBlock(activeBlockId)
                    setInCooldown(false)
                  }
                } else {
                  await handleEndLiveQuiz()
                }
              }}
              data={{ cy: 'next-block-timeline' }}
            >
              <Button.Icon
                icon={
                  buttonState === 'blockActive' && inCooldown
                    ? faFastForward
                    : buttonState === 'firstBlock' ||
                        buttonState === 'nextBlock'
                      ? faPlay
                      : buttonState === 'endQuiz'
                        ? faFlagCheckered
                        : faStop
                }
              />
              <Button.Label>
                {buttonState === 'blockActive' && inCooldown
                  ? t('manage.cockpit.skipCooldown')
                  : t(`manage.cockpit.${buttonState}`)}
              </Button.Label>
            </Button>
          </div>
        </>
      )}
      {!isFeedbackQuiz && embedModalOpen ? (
        <EmbeddingModal
          key={quizId}
          onClose={() => setEmbedModalOpen(false)}
          quizId={quizId}
          isGamificationEnabled={isGamificationEnabled}
        />
      ) : null}
      {cancelLiveQuizModal && (
        <CancelLiveQuizModal
          onClose={() => setCancelLiveQuizModal(false)}
          quizId={quizId}
          title={quizName}
        />
      )}
      {qrModal && (
        <LiveQuizQRModal
          quizId={quizId}
          quizPin={quizPin}
          isAssessmentEnabled={assessmentMode}
          language={language}
          onClose={() => setQRModal(false)}
        />
      )}
      {confirmBlockClosure && (
        <CloseBlockConfirmDialog
          open
          onClose={() => setConfirmBlockClosure(false)}
          onConfirm={async () => {
            if (activeBlockId != null) {
              await handleCloseBlock(activeBlockId)
              setInCooldown(false)
            }
          }}
        />
      )}
    </div>
  )
}

export default LiveQuizTimeline
