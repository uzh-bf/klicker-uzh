import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { TextSizeType } from '../textSizes'

interface NumericalSidebarProps {
  instance: NumericalElementInstanceEvaluation
  textSize: TextSizeType
  showSolution: boolean
}

function NumericalSidebar({
  instance,
  textSize,
  showSolution,
}: NumericalSidebarProps) {
  const t = useTranslations()

  return (
    <div>
      <div className="font-bold">
        {t('manage.evaluation.validSolutionRange')}:
      </div>
      <div>
        [{instance.results.minValue ?? '-∞'},{instance.results.maxValue ?? '+∞'}
        ]
      </div>
      {/* // TODO: reintroduce this, once statistics are available */}
      {/* <div className="mt-4 font-bold">{t('manage.evaluation.statistics')}:</div>
      {currentInstance.statistics ? (
        Object.entries(currentInstance.statistics)
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
                checked={statisticStates[statisticName]}
                onCheck={() => {
                  setStatisticStates({
                    ...statisticStates,
                    [statisticName]: !statisticStates[statisticName],
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
      )} */}
      {showSolution && instance.results.solutionRanges && (
        <div>
          <div className="mt-4 font-bold">
            {t('manage.evaluation.correctSolutionRanges')}:
          </div>
          {instance.results.solutionRanges.map((range, innerIndex) => (
            <div key={innerIndex}>
              [{range?.min || '-∞'},{range?.max || '+∞'}]
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NumericalSidebar
