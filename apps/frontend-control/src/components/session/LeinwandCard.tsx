import { useMutation, useQuery } from '@apollo/client'
import { faLock, faPersonChalkboard } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetControlLiveQuizEvaluationDocument,
  GetLiveQuizEvaluationDisplayDocument,
  UpdateEvaluationDisplayDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ACTIVE_CHART_TYPES,
  type ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { Switch, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { cardClass } from '../common/styles'

interface LeinwandCardProps {
  quizId: string
  blockOrder: number
  selected: number
  live: boolean
  isAssessment?: boolean
}

// Controls how the selected question is shown on the projected evaluation
// (PPT embed); the embed picks the settings up within its polling interval.
function LeinwandCard({
  quizId,
  blockOrder,
  selected,
  live,
  isAssessment,
}: LeinwandCardProps) {
  const t = useTranslations()

  // the evaluation card keeps this query fresh; read the selected question from cache
  const { data: evaluationData } = useQuery(
    GetControlLiveQuizEvaluationDocument,
    { variables: { id: quizId }, fetchPolicy: 'cache-first' }
  )
  const { data: displayData } = useQuery(GetLiveQuizEvaluationDisplayDocument, {
    variables: { id: quizId },
    skip: isAssessment,
  })
  const [updateDisplay, { loading: saving }] = useMutation(
    UpdateEvaluationDisplayDocument,
    { refetchQueries: [GetLiveQuizEvaluationDisplayDocument] }
  )

  if (isAssessment) {
    return (
      <div
        className={twMerge(cardClass, 'flex gap-3 p-4')}
        data-cy="leinwand-locked"
      >
        <FontAwesomeIcon
          icon={faLock}
          className="text-ctrl-muted mt-0.5 h-4 w-4"
        />
        <div>
          <b className="text-ctrl-ink text-base">
            {t('control.liveQuiz.screen')}
          </b>
          <p className="text-ctrl-muted mt-1 text-sm">
            {t('control.liveQuiz.screenLocked')}
          </p>
        </div>
      </div>
    )
  }

  const stack = evaluationData?.liveQuizEvaluation?.results.find(
    (entry) => entry.stackOrder === blockOrder
  )
  const instance =
    stack?.instances[Math.min(selected, (stack?.instances.length ?? 1) - 1)]
  const chartOptions = instance?.type ? ACTIVE_CHART_TYPES[instance.type] : []
  if (!instance || chartOptions.length === 0) return null

  const setting = displayData?.liveQuizEvaluationDisplay?.find(
    (entry) => entry.instanceId === instance.id
  )
  const chartType = setting?.chartType ?? chartOptions[0]!.value
  const hasSolution =
    'hasSampleSolution' in instance && instance.hasSampleSolution
  const isChoices = instance.__typename === 'ChoicesActivityEvaluationData'

  const save = async (changes: {
    chartType?: ChartType
    showSolution?: boolean
    showPercentages?: boolean
  }) => {
    try {
      await updateDisplay({
        variables: { quizId, instanceId: instance.id, ...changes },
      })
    } catch {
      toast({
        type: 'error',
        message: t('control.liveQuiz.actionFailed'),
        options: { duration: 5000 },
      })
    }
  }

  return (
    <div className={twMerge(cardClass, 'p-4')} data-cy="leinwand-card">
      <div className="flex items-center gap-2">
        <FontAwesomeIcon
          icon={faPersonChalkboard}
          className="text-ctrl-ink h-4 w-4"
        />
        <b className="text-ctrl-ink flex-1 text-base">
          {t('control.liveQuiz.screen')}
        </b>
        <span
          className="text-ctrl-good flex items-center gap-1.5 text-[13px] font-semibold"
          aria-live="polite"
        >
          <span
            className={twMerge(
              'bg-ctrl-good h-[7px] w-[7px] rounded-full',
              saving && 'bg-ctrl-faint'
            )}
          />
          {saving
            ? t('control.liveQuiz.screenSaving')
            : t('control.liveQuiz.screenSynced')}
        </span>
      </div>
      <p className="text-ctrl-muted mt-1 text-[13px]">
        {t('control.liveQuiz.screenHint')}
      </p>

      {chartOptions.length > 1 && (
        <fieldset
          aria-label={t('control.liveQuiz.screenDisplay')}
          className="bg-ctrl-hair mt-3 flex min-w-0 gap-1 rounded-md border-0 p-[3px]"
        >
          {chartOptions.map((option) => {
            const active = option.value === chartType
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                disabled={saving}
                onClick={() => save({ chartType: option.value })}
                data-cy={`leinwand-chart-${option.value}`}
                className={twMerge(
                  'text-ctrl-ink-2 min-h-9 flex-1 rounded text-sm font-semibold',
                  active && 'shadow-ctrl text-uzh-blue bg-white'
                )}
              >
                {t(option.label)}
              </button>
            )
          })}
        </fieldset>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <Switch
            checked={(setting?.showSolution ?? false) && hasSolution}
            onCheckedChange={(value) => save({ showSolution: value })}
            disabled={saving || live || !hasSolution}
            label={t('control.liveQuiz.screenShowSolution')}
            data={{ cy: 'leinwand-show-solution' }}
          />
          {live && hasSolution && (
            <p className="text-ctrl-muted mt-1 text-[13px]">
              {t('control.liveQuiz.screenSolutionAfterClose')}
            </p>
          )}
        </div>
        {isChoices && (
          <Switch
            checked={setting?.showPercentages ?? false}
            onCheckedChange={(value) => save({ showPercentages: value })}
            disabled={saving}
            label={t('control.liveQuiz.screenShowPercentages')}
            data={{ cy: 'leinwand-show-percentages' }}
          />
        )}
      </div>
    </div>
  )
}

export default LeinwandCard
