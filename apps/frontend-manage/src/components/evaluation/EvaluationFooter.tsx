import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { Select, Switch, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActiveStackType } from './ActivityEvaluation'
import EvaluationFooterMenu from './EvaluationFooterMenu'
import { TextSizeType } from './textSizes'

interface EvaluationFooterProps {
  type: 'LiveQuiz' | 'Asynchronous'
  currentInstance?: ElementInstanceEvaluation
  activeStack: ActiveStackType
  isStackActive: boolean
  textSize: TextSizeType
  setTextSize: Dispatch<{ type: string }>
  showSolution: boolean
  setShowSolution: Dispatch<SetStateAction<boolean>>
  showExplanation: boolean
  setShowExplanation: Dispatch<SetStateAction<boolean>>
  chartType: ChartType
  setChartType: (newValue: ChartType) => void
  onDownloadCorrelatedResponses?: () => void
  correlatedExportLoading?: boolean
}

function EvaluationFooter({
  type,
  currentInstance,
  activeStack,
  isStackActive,
  textSize,
  setTextSize,
  showSolution,
  setShowSolution,
  showExplanation,
  setShowExplanation,
  chartType,
  setChartType,
  onDownloadCorrelatedResponses,
  correlatedExportLoading,
}: EvaluationFooterProps) {
  const t = useTranslations()
  const hasSolution = currentInstance?.hasSampleSolution ?? false
  const hasExplanation =
    currentInstance?.explanation &&
    currentInstance?.explanation !== '' &&
    !currentInstance?.explanation.match(/^(<br>(\n)*)$/g)
  const hasSolutionAndExplanation = hasSolution && hasExplanation

  return (
    <Footer>
      {typeof activeStack === 'number' && (
        <div className="m-0 flex flex-row items-center justify-between py-2.5">
          <div className="text-lg" data-cy="live-quiz-total-participants">
            {(currentInstance?.results.anonymousAnswers ?? 0) > 0 &&
            type === 'Asynchronous'
              ? t('manage.evaluation.totalParticipantsInclAnon', {
                  number: currentInstance?.results.totalAnswers ?? 0,
                  anonymous: currentInstance?.results.anonymousAnswers ?? 0,
                })
              : t('manage.evaluation.totalParticipants', {
                  number: currentInstance?.results.totalAnswers ?? 0,
                })}
          </div>
          <div className="flex flex-row items-center gap-7">
            {hasSolution || hasExplanation ? (
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-col gap-1">
                  {hasSolution && (
                    <Switch
                      disabled={isStackActive}
                      size={hasSolutionAndExplanation ? 'sm' : undefined}
                      checked={!isStackActive && showSolution}
                      label={t('manage.evaluation.showSolution')}
                      onCheckedChange={(newValue) => setShowSolution(newValue)}
                      data={{ cy: 'evaluation-footer-show-solution' }}
                      className={{
                        label: twMerge(hasSolutionAndExplanation && 'text-sm'),
                      }}
                    />
                  )}
                  {hasExplanation &&
                    currentInstance.type !== ElementType.Flashcard && (
                      <Switch
                        disabled={isStackActive}
                        size={hasSolutionAndExplanation ? 'sm' : undefined}
                        checked={!isStackActive && showExplanation}
                        label={t('manage.evaluation.showExplanation')}
                        onCheckedChange={(newValue) =>
                          setShowExplanation(newValue)
                        }
                        data={{ cy: 'evaluation-footer-show-explanation' }}
                        className={{
                          label: twMerge(
                            hasSolutionAndExplanation && 'text-sm'
                          ),
                        }}
                      />
                    )}
                </div>
                {isStackActive && (
                  <Tooltip
                    tooltip={t('manage.evaluation.solutionHiddenWhileActive')}
                  >
                    <FontAwesomeIcon
                      icon={faTriangleExclamation}
                      className="text-orange-500"
                    />
                  </Tooltip>
                )}
              </div>
            ) : null}
            {currentInstance?.type &&
            ACTIVE_CHART_TYPES[currentInstance.type].length > 1 ? (
              <Select
                contentPosition="popper"
                className={{ trigger: 'w-44 border-slate-400' }}
                items={ACTIVE_CHART_TYPES[currentInstance.type].map((item) => ({
                  label: t(item.label),
                  value: item.value,
                  data: { cy: `change-chart-type-${item.label}` },
                }))}
                value={chartType}
                onChange={(newValue) => setChartType(newValue as ChartType)}
                data={{ cy: 'change-chart-type' }}
              />
            ) : null}
            <EvaluationFooterMenu
              textSize={textSize}
              setTextSize={setTextSize}
              onDownloadCorrelatedResponses={onDownloadCorrelatedResponses}
              correlatedExportLoading={correlatedExportLoading}
            />
          </div>
        </div>
      )}
    </Footer>
  )
}

export default EvaluationFooter
