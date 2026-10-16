import { useQuery } from '@apollo/client'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetControlLiveQuizEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import LiveDot from '../common/LiveDot'
import { cardClass } from '../common/styles'
import { blockParticipants } from './LiveEvaluationCard'
import useRemainingSeconds, { formatSeconds } from './useRemainingSeconds'

interface StatusBlock {
  order: number
  expiresAt?: string | Date | null
  numOfParticipants?: number | null
  elements?: { id: number; elementData?: { name: string } | null }[] | null
}

interface BlockStatusCardProps {
  quizId: string
  activeBlock?: StatusBlock
  nextBlock?: StatusBlock
  numOfBlocks: number
  isAssessment?: boolean
}

const bigNumberClass =
  'text-ctrl-ink text-4xl leading-none font-bold tabular-nums'

function QuestionList({ block }: { block: StatusBlock }) {
  return (
    <ol className="text-ctrl-ink flex list-decimal flex-col gap-1 pl-5 text-[15px]">
      {block.elements?.map((element) => (
        <li key={element.id}>{element.elementData?.name}</li>
      ))}
    </ol>
  )
}

function ActiveBlockStatus({
  quizId,
  block,
  numOfBlocks,
  isAssessment,
}: {
  quizId: string
  block: StatusBlock
  numOfBlocks: number
  isAssessment?: boolean
}) {
  const t = useTranslations()
  const remaining = useRemainingSeconds(block.expiresAt)

  // the live evaluation card keeps this query fresh
  const { data } = useQuery(GetControlLiveQuizEvaluationDocument, {
    variables: { id: quizId },
    fetchPolicy: 'cache-first',
  })
  const stack = data?.liveQuizEvaluation?.results.find(
    (entry) => entry.stackOrder === block.order
  )
  const answers = blockParticipants(block.numOfParticipants, stack?.instances)

  return (
    <div
      className={twMerge(cardClass, 'border-uzh-blue p-4')}
      data-cy="block-status-active"
    >
      <div className="text-uzh-blue flex items-center gap-2 text-sm font-bold">
        <LiveDot />
        {t('control.liveQuiz.blockRunning', {
          number: block.order + 1,
          total: numOfBlocks,
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        {remaining === null ? (
          <div className="text-ctrl-muted self-end text-sm">
            {t('control.liveQuiz.noTimeLimit')}
          </div>
        ) : (
          <div>
            <div
              className={twMerge(
                bigNumberClass,
                remaining === 0 && 'text-uzh-red'
              )}
            >
              {formatSeconds(remaining)}
            </div>
            <div className="text-ctrl-muted mt-1 text-[13px]">
              {remaining === 0
                ? t('control.liveQuiz.timeUp')
                : t('control.liveQuiz.remaining')}
            </div>
          </div>
        )}
        <div data-cy="block-status-answers">
          <div className={bigNumberClass}>{answers}</div>
          <div className="text-ctrl-muted mt-1 text-[13px]">
            {isAssessment
              ? t('control.liveQuiz.submissions')
              : t('control.liveQuiz.answers')}
          </div>
        </div>
      </div>
      <div className="border-ctrl-hair mt-4 border-t pt-3">
        <QuestionList block={block} />
      </div>
    </div>
  )
}

function BlockStatusCard({
  quizId,
  activeBlock,
  nextBlock,
  numOfBlocks,
  isAssessment,
}: BlockStatusCardProps) {
  const t = useTranslations()

  if (activeBlock) {
    return (
      <ActiveBlockStatus
        key={activeBlock.order}
        quizId={quizId}
        block={activeBlock}
        numOfBlocks={numOfBlocks}
        isAssessment={isAssessment}
      />
    )
  }

  if (nextBlock) {
    return (
      <div className={twMerge(cardClass, 'p-4')} data-cy="block-status-next">
        <div className="text-ctrl-muted mb-2.5 text-sm font-bold">
          {t('control.liveQuiz.upNext', {
            number: nextBlock.order + 1,
            total: numOfBlocks,
          })}
        </div>
        <QuestionList block={nextBlock} />
      </div>
    )
  }

  return (
    <div className={twMerge(cardClass, 'p-4')} data-cy="block-status-done">
      <div className="text-ctrl-ink flex items-center gap-2 text-[17px] font-bold">
        <FontAwesomeIcon icon={faCheck} className="text-ctrl-good h-5 w-5" />
        {t('control.liveQuiz.allBlocksDone')}
      </div>
      <div className="text-ctrl-muted mt-1 text-sm">
        {t('control.liveQuiz.allBlocksDoneHint')}
      </div>
    </div>
  )
}

export default BlockStatusCard
