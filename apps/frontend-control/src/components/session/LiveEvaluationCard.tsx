import { useQuery } from '@apollo/client'
import {
  GetControlLiveQuizEvaluationDocument,
  type GetControlLiveQuizEvaluationQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { cardClass } from '../common/styles'

export type Stack = NonNullable<
  NonNullable<
    GetControlLiveQuizEvaluationQuery['liveQuizEvaluation']
  >['results'][number]
>
export type Instance = Stack['instances'][number]

const percent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0

// strip the most common markdown so answer options read as plain text
const plain = (value: string) =>
  value
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function ChoiceBars({
  choices,
  total,
}: {
  choices: { value: string; count: number }[]
  total: number
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {choices.map((choice, ix) => (
        <div key={choice.value}>
          <div className="text-ctrl-ink mb-1 flex gap-2 text-sm">
            <b className="text-ctrl-muted">{String.fromCharCode(65 + ix)}</b>
            <span className="min-w-0 flex-1 truncate">
              {plain(choice.value)}
            </span>
            <b className="tabular-nums">{percent(choice.count, total)}%</b>
          </div>
          <div className="bg-ctrl-hair h-2 overflow-hidden rounded">
            <div
              className="bg-uzh-blue h-full transition-[width] duration-500"
              style={{ width: `${percent(choice.count, total)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function NumericalHistogram({
  values,
}: {
  values: { value: number; count: number }[]
}) {
  const t = useTranslations()
  // non-numeric responses aggregate to NaN; skip them instead of crashing
  const finite = values.filter((v) => Number.isFinite(v.value))
  if (finite.length === 0) {
    return (
      <div className="text-ctrl-muted py-3 text-sm">
        {t('control.liveQuiz.noAnswersYet')}
      </div>
    )
  }
  const min = Math.min(...finite.map((v) => v.value))
  const max = Math.max(...finite.map((v) => v.value))
  const numBins = min === max ? 1 : 5
  const width = (max - min) / numBins || 1
  const bins = Array.from({ length: numBins }, (_, ix) => ({
    from: min + ix * width,
    to: min + (ix + 1) * width,
    count: 0,
  }))
  for (const { value, count } of finite) {
    const ix = Math.min(numBins - 1, Math.floor((value - min) / width))
    bins[ix]!.count += count
  }
  const highest = Math.max(1, ...bins.map((bin) => bin.count))
  const format = (n: number) => Number(n.toPrecision(3)).toString()

  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {bins.map((bin) => (
          <div
            key={bin.from}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <b className="text-ctrl-ink text-xs tabular-nums">{bin.count}</b>
            <div
              className="bg-uzh-blue min-h-0.5 w-full rounded-t-sm transition-[height] duration-500"
              style={{ height: `${(bin.count / highest) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="border-ctrl-border text-ctrl-muted flex gap-1 border-t pt-1 text-[11px] font-semibold">
        {bins.map((bin) => (
          <div key={bin.from} className="min-w-0 flex-1 truncate text-center">
            {numBins === 1
              ? format(bin.from)
              : `${format(bin.from)}–${format(bin.to)}`}
          </div>
        ))}
      </div>
    </div>
  )
}

function FreeTextList({
  responses,
}: {
  responses: { value: string; count: number }[]
}) {
  const top = [...responses].sort((a, b) => b.count - a.count).slice(0, 8)
  return (
    <ul className="flex flex-col gap-1.5">
      {top.map((response) => (
        <li key={response.value} className="text-ctrl-ink flex gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{response.value}</span>
          <b className="tabular-nums">{response.count}</b>
        </li>
      ))}
    </ul>
  )
}

function InstanceChart({ instance }: { instance: Instance }) {
  const t = useTranslations()
  const total =
    'results' in instance &&
    instance.results &&
    'totalAnswers' in instance.results
      ? (instance.results.totalAnswers ?? 0)
      : 0

  if (total === 0) {
    return (
      <div className="text-ctrl-muted py-3 text-sm">
        {t('control.liveQuiz.noAnswersYet')}
      </div>
    )
  }

  switch (instance.__typename) {
    case 'ChoicesActivityEvaluationData':
      return <ChoiceBars choices={instance.results.choices} total={total} />
    case 'NumericalActivityEvaluationData':
      return <NumericalHistogram values={instance.results.responseValues} />
    case 'FreeTextActivityEvaluationData':
      return <FreeTextList responses={instance.results.responses} />
    default:
      return (
        <div className="text-ctrl-muted text-sm">
          {t('control.liveQuiz.evaluationInManage')}
        </div>
      )
  }
}

export function answerCount(instance: Instance) {
  return 'results' in instance &&
    instance.results &&
    'totalAnswers' in instance.results
    ? (instance.results.totalAnswers ?? 0)
    : 0
}

interface LiveEvaluationCardProps {
  quizId: string
  blockOrder: number
  live: boolean
  isAssessment?: boolean
  // selected question index, shared with the Leinwand card
  selected: number
  onSelect: (index: number) => void
}

function LiveEvaluationCard({
  quizId,
  blockOrder,
  live,
  isAssessment,
  selected,
  onSelect,
}: LiveEvaluationCardProps) {
  const t = useTranslations()
  const { data } = useQuery(GetControlLiveQuizEvaluationDocument, {
    variables: { id: quizId },
    // live counts while the block runs; closed results only change once
    pollInterval: live ? 2000 : 0,
  })

  const stack = data?.liveQuizEvaluation?.results.find(
    (entry) => entry.stackOrder === blockOrder
  )
  if (!stack || stack.instances.length === 0) return null

  const title = live
    ? t('control.liveQuiz.liveEvaluation')
    : t('control.liveQuiz.resultBlockN', { number: blockOrder + 1 })

  // exams: only submission counts per question, no distributions
  if (isAssessment) {
    return (
      <div className={twMerge(cardClass, 'p-4')} data-cy="live-evaluation">
        <b className="text-ctrl-ink text-base">
          {t('control.liveQuiz.submissionsPerQuestion')}
        </b>
        <ol className="mt-3 flex flex-col gap-1.5">
          {stack.instances.map((instance, ix) => (
            <li key={instance.id} className="text-ctrl-ink flex gap-2 text-sm">
              <span className="text-ctrl-muted font-semibold">{ix + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{instance.name}</span>
              <b className="tabular-nums">{answerCount(instance)}</b>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const index = Math.min(selected, stack.instances.length - 1)
  const instance = stack.instances[index]!

  return (
    <div className={twMerge(cardClass, 'p-4')} data-cy="live-evaluation">
      {/* many questions wrap below the title instead of overflowing */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <b className="text-ctrl-ink flex-1 text-base whitespace-nowrap">
          {title}
        </b>
        {stack.instances.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {stack.instances.map((entry, ix) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(ix)}
                aria-label={t('control.liveQuiz.questionN', { number: ix + 1 })}
                aria-pressed={ix === index}
                data-cy={`evaluation-question-${ix + 1}`}
                className={twMerge(
                  'border-ctrl-border text-ctrl-ink-2 h-9 w-9 rounded-md border bg-white text-sm font-bold',
                  ix === index && 'border-uzh-blue bg-uzh-blue-20 text-uzh-blue'
                )}
              >
                {ix + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="text-ctrl-ink mb-3 text-[15px] font-semibold">
        {instance.name}
      </div>
      <InstanceChart instance={instance} />
    </div>
  )
}

export default LiveEvaluationCard
