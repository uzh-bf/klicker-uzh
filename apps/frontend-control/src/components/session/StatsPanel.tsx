import { useQuery } from '@apollo/client'
import {
  ElementBlockStatus,
  GetControlLiveQuizEvaluationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import LiveDot from '../common/LiveDot'
import { cardClass } from '../common/styles'
import { answerCount } from './LiveEvaluationCard'

interface StatsBlock {
  id: number
  order: number
  status: ElementBlockStatus
  numOfParticipants?: number | null
}

interface StatsPanelProps {
  quizId: string
  blocks: StatsBlock[]
  isAssessment?: boolean
  // Q&A totals, only when the quiz has Q&A enabled or questions
  questions?: { total: number; unanswered: number }
}

function Kpi({
  label,
  value,
  sub,
  live,
  dataCy,
}: {
  label: string
  value: string | number
  sub: string
  live?: boolean
  dataCy: string
}) {
  return (
    <div className={twMerge(cardClass, 'min-w-0 p-3.5')} data-cy={dataCy}>
      <div className="text-ctrl-muted flex items-center gap-1.5 text-[13px] font-semibold">
        {live && <LiveDot className="h-1.5 w-1.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-ctrl-ink mt-1 text-[28px] leading-[1.1] font-bold tabular-nums">
        {value}
      </div>
      <div className="text-ctrl-muted truncate text-[13px]">{sub}</div>
    </div>
  )
}

// Session statistics from data the API already provides: block progress,
// votes per block (results) and people who answered each block
function StatsPanel({
  quizId,
  blocks,
  isAssessment,
  questions,
}: StatsPanelProps) {
  const t = useTranslations()
  const live = blocks.some(
    (block) => block.status === ElementBlockStatus.Active
  )
  const { data } = useQuery(GetControlLiveQuizEvaluationDocument, {
    variables: { id: quizId },
    pollInterval: live ? 5000 : 0,
  })

  const votesByOrder = new Map<
    number,
    { votes: number; questions: number; mostAnswered: number }
  >()
  for (const stack of data?.liveQuizEvaluation?.results ?? []) {
    const counts = stack.instances.map(answerCount)
    votesByOrder.set(stack.stackOrder, {
      votes: counts.reduce((sum, count) => sum + count, 0),
      questions: stack.instances.length,
      mostAnswered: Math.max(0, ...counts),
    })
  }
  // numOfParticipants only counts people who answered every question of a
  // block; the most answered question is a better measure of who took part
  const participantsOf = (block: StatsBlock) =>
    Math.max(
      block.numOfParticipants ?? 0,
      votesByOrder.get(block.order)?.mostAnswered ?? 0
    )

  const started = blocks.filter(
    (block) => block.status !== ElementBlockStatus.Scheduled
  )
  const totalVotes = started.reduce(
    (sum, block) => sum + (votesByOrder.get(block.order)?.votes ?? 0),
    0
  )
  const avgParticipants = started.length
    ? Math.round(
        started.reduce((sum, block) => sum + participantsOf(block), 0) /
          started.length
      )
    : 0
  // bars compare the blocks with each other (no total audience is known)
  const maxParticipants = Math.max(1, ...started.map(participantsOf))

  return (
    <div className="flex flex-col gap-3" data-cy="stats-panel">
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
        <Kpi
          label={t('control.liveQuiz.statsBlocks')}
          value={`${started.length} / ${blocks.length}`}
          sub={t('control.liveQuiz.statsBlocksSub')}
          live={live}
          dataCy="stats-blocks"
        />
        <Kpi
          label={
            isAssessment
              ? t('control.liveQuiz.statsSubmissions')
              : t('control.liveQuiz.statsVotes')
          }
          value={totalVotes}
          sub={t('control.liveQuiz.statsVotesSub')}
          dataCy="stats-votes"
        />
        <Kpi
          label={t('control.liveQuiz.statsAvgParticipants')}
          value={avgParticipants}
          sub={t('control.liveQuiz.statsAvgParticipantsSub')}
          dataCy="stats-participants"
        />
        <Kpi
          label={t('control.liveQuiz.statsQuestions')}
          value={questions ? questions.total : '—'}
          sub={
            questions
              ? t('control.liveQuiz.statsQuestionsSub', {
                  count: questions.unanswered,
                })
              : t('control.liveQuiz.statsQuestionsOff')
          }
          dataCy="stats-questions"
        />
      </div>

      <div className={twMerge(cardClass, 'overflow-hidden')}>
        <div className="text-ctrl-ink border-ctrl-hair border-b px-4 py-3 text-base font-bold">
          {t('control.liveQuiz.statsPerBlock')}
        </div>
        <ul>
          {blocks.map((block) => {
            const scheduled = block.status === ElementBlockStatus.Scheduled
            const active = block.status === ElementBlockStatus.Active
            const participants = participantsOf(block)
            const votes = votesByOrder.get(block.order)
            return (
              <li
                key={block.id}
                className="border-ctrl-hair border-b px-4 py-3 last:border-b-0"
                data-cy={`stats-block-${block.order + 1}`}
              >
                <div className="flex items-center gap-2">
                  <b
                    className={twMerge(
                      'text-ctrl-ink flex-1 text-[15px]',
                      scheduled && 'text-ctrl-muted'
                    )}
                  >
                    {t('control.liveQuiz.statsBlockN', {
                      number: block.order + 1,
                    })}
                  </b>
                  <span
                    className={twMerge(
                      'rounded px-1.5 py-0.5 text-xs font-semibold',
                      active && 'bg-uzh-blue-20 text-uzh-blue',
                      block.status === ElementBlockStatus.Executed &&
                        'bg-ctrl-good-bg text-ctrl-good',
                      scheduled && 'bg-ctrl-hair text-ctrl-muted'
                    )}
                  >
                    {active
                      ? t('control.liveQuiz.statsRunning')
                      : scheduled
                        ? t('control.liveQuiz.statsScheduled')
                        : t('control.liveQuiz.statsClosed')}
                  </span>
                  <span className="text-ctrl-ink min-w-12 text-right text-[15px] font-bold tabular-nums">
                    {scheduled ? '—' : participants}
                  </span>
                </div>
                {!scheduled && (
                  <>
                    <div className="bg-ctrl-hair mt-2 h-1.5 overflow-hidden rounded-sm">
                      <div
                        className={twMerge(
                          'h-full transition-[width] duration-500',
                          active ? 'bg-uzh-blue' : 'bg-ctrl-good'
                        )}
                        style={{
                          width: `${(participants / maxParticipants) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-ctrl-muted mt-1 text-[13px]">
                      {t('control.liveQuiz.statsBlockDetail', {
                        participants,
                        votes: votes?.votes ?? 0,
                        questions: votes?.questions ?? 0,
                      })}
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default StatsPanel
