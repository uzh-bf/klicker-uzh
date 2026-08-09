import {
  LocaleType,
  NumericalActivityEvaluationData,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ChartType,
  STATISTICS_ORDER,
} from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import LiveQuizEvaluationQRCode from './LiveQuizEvaluationQRCode'
import { ShowStatisticsType } from './NREvaluation'
import Statistic from './Statistic'

interface NRSidebarProps {
  instance: NumericalActivityEvaluationData
  courseLanguage?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  chartType: ChartType
  textSize: TextSizeType
  showSolution: boolean
  showStatistics: ShowStatisticsType
  setShowStatistics: Dispatch<SetStateAction<ShowStatisticsType>>
  type: ActivityEvaluationType
}

function NRSidebar({
  instance,
  courseLanguage,
  isAssessmentEnabled,
  pinCode,
  chartType,
  textSize,
  showSolution,
  showStatistics,
  setShowStatistics,
  type,
}: NRSidebarProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div
      className={twMerge(
        'order-1 flex h-full w-full flex-col justify-between overflow-hidden pb-1 pt-2 md:order-2',
        textSize.text
      )}
    >
      <div
        className={twMerge(
          'flex h-max max-h-full flex-col gap-2 overflow-y-auto px-2',
          textSize.textLg
        )}
      >
        <div className="font-bold">
          {t('manage.evaluation.validSolutionRange')}:
        </div>
        <div>
          [{instance.results.minValue ?? '-∞'},
          {instance.results.maxValue ?? '+∞'}]
        </div>
        <div className="mt-4 font-bold">
          {t('manage.evaluation.statistics')}:
        </div>
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
            {instance.results.solutionRanges.map((range) => (
              <div key={`solution-range-${range?.min}-${range?.max}`}>
                [{range?.min ?? '-∞'},{range?.max ?? '+∞'}]
              </div>
            ))}
          </div>
        )}
        {showSolution && instance.results.exactSolutions && (
          <div className={textSize.textLg}>
            <div className="mt-4 font-bold">
              {t('manage.evaluation.correctExactSolutions')}:
            </div>
            <ul>
              {instance.results.exactSolutions.map((solution) => (
                <li key={`solution-${solution}`}>{solution}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {type === 'LiveQuiz' && !router.query.hmac && (
        <LiveQuizEvaluationQRCode
          language={courseLanguage}
          isAssessmentEnabled={isAssessmentEnabled}
          pinCode={pinCode}
        />
      )}
    </div>
  )
}

export default NRSidebar
