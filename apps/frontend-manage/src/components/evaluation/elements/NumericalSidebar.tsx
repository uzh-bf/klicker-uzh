import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import {
  ChartType,
  STATISTICS_ORDER,
} from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { TextSizeType } from '../textSizes'
import { ShowStatisticsType } from './NREvaluation'
import Statistic from './Statistic'

interface NumericalSidebarProps {
  instance: NumericalElementInstanceEvaluation
  chartType: ChartType
  textSize: TextSizeType
  showSolution: boolean
  showStatistics: ShowStatisticsType
  setShowStatistics: Dispatch<SetStateAction<ShowStatisticsType>>
}

function NumericalSidebar({
  instance,
  chartType,
  textSize,
  showSolution,
  showStatistics,
  setShowStatistics,
}: NumericalSidebarProps) {
  const t = useTranslations()

  return (
    <div className={textSize.textLg}>
      <div className="font-bold">
        {t('manage.evaluation.validSolutionRange')}:
      </div>
      <div>
        [{instance.results.minValue ?? '-∞'},{instance.results.maxValue ?? '+∞'}
        ]
      </div>
      <div className="mt-4 font-bold">{t('manage.evaluation.statistics')}:</div>
      {instance.statistics ? (
        Object.entries(instance.statistics)
          .slice(1)
          .sort(
            (a, b) =>
              STATISTICS_ORDER.indexOf(a[0]) - STATISTICS_ORDER.indexOf(b[0])
          )
          .map((statistic) => {
            const statisticName = statistic[0]
            const statisticValue = statistic[1] as number
            return (
              <Statistic
                key={statisticName}
                statisticName={statisticName}
                value={statisticValue}
                hasCheckbox={
                  !(statisticName === 'min' || statisticName === 'max')
                }
                chartType={chartType}
                checked={
                  showStatistics[statisticName as keyof ShowStatisticsType] ??
                  false
                }
                onCheck={() => {
                  setShowStatistics({
                    ...showStatistics,
                    [statisticName]:
                      !showStatistics[
                        statisticName as keyof ShowStatisticsType
                      ],
                  })
                }}
                size={textSize.size}
              />
            )
          })
      ) : (
        <UserNotification type="info">
          {t('manage.evaluation.noStatistics')}
        </UserNotification>
      )}
      {showSolution && instance.results.solutionRanges && (
        <div className={textSize.textLg}>
          <div className="mt-4 font-bold">
            {t('manage.evaluation.correctSolutionRanges')}:
          </div>
          {instance.results.solutionRanges.map((range, innerIndex) => (
            <div key={innerIndex}>
              [{range?.min ?? '-∞'},{range?.max ?? '+∞'}]
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NumericalSidebar
