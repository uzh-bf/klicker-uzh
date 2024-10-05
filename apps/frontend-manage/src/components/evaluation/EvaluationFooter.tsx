import { faFont, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { Button, Select, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch } from 'react'
import { ActiveStackType } from './ActivityEvaluation'
import { TextSizeType } from './textSizes'

interface EvaluationFooterProps {
  currentInstance: ElementInstanceEvaluation
  activeStack: ActiveStackType
  textSize: TextSizeType
  setTextSize: Dispatch<{
    type: string
  }>
  showSolution: boolean
  setShowSolution: (newValue: boolean) => void
  chartType: ChartType
  setChartType: (newValue: ChartType) => void
}

function EvaluationFooter({
  currentInstance,
  activeStack,
  textSize,
  setTextSize,
  showSolution,
  setShowSolution,
  chartType,
  setChartType,
}: EvaluationFooterProps) {
  const t = useTranslations()

  return (
    <Footer>
      {typeof activeStack === 'number' && (
        <div className="m-0 flex flex-row items-center justify-between py-2.5">
          <div className="text-lg" data-cy="session-total-participants">
            {currentInstance.results.anonymousAnswers > 0
              ? t('manage.evaluation.totalParticipantsInclAnon', {
                  number: currentInstance.results.totalAnswers,
                  anonymous: currentInstance.results.anonymousAnswers,
                })
              : t('manage.evaluation.totalParticipants', {
                  number: currentInstance.results.totalAnswers,
                })}
          </div>
          <div className="flex flex-row items-center gap-7">
            <div className="ml-2 flex flex-row items-center gap-2">
              <Button
                onClick={() => {
                  setTextSize({ type: 'decrease' })
                }}
                disabled={textSize.size === 'sm'}
                className={{
                  root: 'flex h-8 w-8 items-center justify-center',
                }}
                data={{ cy: 'decrease-font-size' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faMinus} />
                </Button.Icon>
              </Button>
              <Button
                onClick={() => {
                  setTextSize({ type: 'increase' })
                }}
                disabled={textSize.size === 'xl'}
                className={{
                  root: 'flex h-8 w-8 items-center justify-center',
                }}
                data={{ cy: 'increase-font-size' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPlus} />
                </Button.Icon>
              </Button>
              <FontAwesomeIcon icon={faFont} size="lg" />
              {t('manage.evaluation.fontSize')}
            </div>
            {currentInstance.hasSampleSolution && (
              <Switch
                checked={showSolution}
                label={t('manage.evaluation.showSolution')}
                onCheckedChange={(newValue) => setShowSolution(newValue)}
              />
            )}
            <Select
              contentPosition="popper"
              className={{
                trigger: 'w-36 border-slate-400',
              }}
              items={ACTIVE_CHART_TYPES[currentInstance.type].map((item) => {
                return {
                  label: t(item.label),
                  value: item.value,
                  data: { cy: `change-chart-type-${item.label}` },
                }
              })}
              value={chartType}
              onChange={(newValue) => setChartType(newValue as ChartType)}
              data={{ cy: 'change-chart-type' }}
            />
          </div>
        </div>
      )}
    </Footer>
  )
}

export default EvaluationFooter
