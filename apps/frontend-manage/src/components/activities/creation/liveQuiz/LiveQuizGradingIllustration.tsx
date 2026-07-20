import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
} from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

function LiveQuizGradingIllustration({
  defaultPointsValue,
  correctPointsValue,
  maxBonusValue,
  timeToZeroValue,
  multiplier,
}: {
  defaultPointsValue: string
  correctPointsValue: string
  maxBonusValue: string
  timeToZeroValue: string
  multiplier: string
}) {
  const t = useTranslations()
  const multiplierValue = parseInt(multiplier, 10)
  const defaultPoints = parseInt(defaultPointsValue, 10) ?? LQ_DEFAULT_POINTS
  const defaultCorrectPoints =
    parseInt(correctPointsValue, 10) ?? LQ_DEFAULT_CORRECT_POINTS
  const maxBonus = parseInt(maxBonusValue, 10) ?? 0
  const timeToZero = parseInt(timeToZeroValue, 10) ?? 0

  return (
    <ResponsiveContainer className="mb-4" height={215}>
      <LineChart
        data={[
          {
            time: 0,
            correctPoints:
              defaultPoints +
              multiplierValue * (defaultCorrectPoints + maxBonus),
            wrongPoints: defaultPoints,
          },
          {
            time: timeToZero,
            correctPoints:
              defaultPoints + multiplierValue * defaultCorrectPoints,
            wrongPoints: defaultPoints,
          },
          {
            time: 2 * timeToZero,
            correctPoints:
              defaultPoints + multiplierValue * defaultCorrectPoints,
            wrongPoints: defaultPoints,
          },
        ]}
        margin={{ top: 0, right: 20, left: -20, bottom: 13 }}
        height={150}
      >
        <CartesianGrid strokeDasharray="6 6" />
        <XAxis
          dataKey="time"
          domain={[0, 2 * parseInt(timeToZeroValue)]}
          type="number"
        >
          <Label
            value={t('manage.activityWizard.liveQuizTSinceFirstCorrect')}
            offset={-10}
            position="insideBottom"
          />
        </XAxis>
        <YAxis
          domain={[
            0,
            defaultPoints +
              multiplierValue *
                (defaultCorrectPoints + parseInt(maxBonusValue)) +
              10,
          ]}
          type="number"
        />
        <Line
          type="linear"
          dataKey="correctPoints"
          stroke="#006400"
          strokeWidth={2}
        />
        <Line
          type="linear"
          dataKey="wrongPoints"
          stroke="#ed2939"
          strokeWidth={2}
        />
        <Legend
          layout="horizontal"
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: '8px' }}
          formatter={(value: string) => {
            if (value === 'correctPoints') {
              return (
                <span style={{ color: '#006400' }}>
                  {t('manage.activityWizard.liveQuizCorrectAnswersPoints')}
                </span>
              )
            }
            if (value === 'wrongPoints') {
              return (
                <span style={{ color: '#ed2939' }}>
                  {t('manage.activityWizard.liveQuizIncorrectAnswersPoints')}
                </span>
              )
            }
            return value
          }}
        />
        <RechartsTooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const time = payload[0].payload.time
              const correctPoints = payload[0].payload.correctPoints
              const wrongPoints = payload[0].payload.wrongPoints

              return (
                <div className="border-primary-100 rounded border border-solid bg-white p-2 text-sm text-gray-600">
                  <div>
                    {t('manage.activityWizard.liveQuizAnswerTime', {
                      answerTime: time,
                    })}
                  </div>
                  <div>
                    {t(
                      'manage.activityWizard.liveQuizTotalAwardedPointsCorrect',
                      {
                        totalPoints: correctPoints,
                      }
                    )}
                  </div>
                  <div>
                    {t(
                      'manage.activityWizard.liveQuizTotalAwardedPointsIncorrect',
                      {
                        totalPoints: wrongPoints,
                      }
                    )}
                  </div>
                </div>
              )
            }

            return null
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default LiveQuizGradingIllustration
