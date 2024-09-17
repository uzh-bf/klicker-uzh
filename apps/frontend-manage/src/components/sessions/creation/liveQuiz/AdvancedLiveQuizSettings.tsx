import { faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import { Button, FormikNumberField, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

function AdvancedLiveQuizSettings({
  maxBonusValue,
  timeToZeroValue,
}: {
  maxBonusValue: string
  timeToZeroValue: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button basic onClick={() => setOpen(true)}>
          <FontAwesomeIcon icon={faGears} className="hover:text-primary-100" />
        </Button>
      }
      title={t('manage.sessionForms.liveQuizAdvancedSettings')}
      className={{ content: 'h-max min-h-max' }}
    >
      <div className="flex flex-row">
        <div className="mr-8 w-1/2">
          <FormikNumberField
            required
            precision={0}
            name="maxBonusPoints"
            label={t('manage.sessionForms.liveQuizMaxBonusPoints')}
            tooltip={t('manage.sessionForms.liveQuizMaxBonusPointsTooltip', {
              defaultValue: LQ_MAX_BONUS_POINTS,
            })}
          />
          <FormikNumberField
            required
            precision={0}
            name="timeToZeroBonus"
            label={t('manage.sessionForms.liveQuizTimeToZeroBonus')}
            tooltip={t('manage.sessionForms.liveQuizTimeToZeroBonusTooltip', {
              defaultValue: LQ_TIME_TO_ZERO_BONUS,
            })}
          />
        </div>
        <div className="w-1/2">
          <div className="mb-2 font-bold">
            {t('manage.sessionForms.liveQuizTotalPointsCorrect')}
          </div>
          <ResponsiveContainer className="mb-4" height={150}>
            <LineChart
              data={[
                { time: 0, points: 10 + parseInt(maxBonusValue) },
                { time: parseInt(timeToZeroValue), points: 10 },
                { time: 2 * parseInt(timeToZeroValue), points: 10 },
              ]}
              margin={{ top: 0, right: 20, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="6 6" />

              <XAxis
                dataKey="time"
                domain={[0, 2 * parseInt(timeToZeroValue)]}
                type="number"
              />
              <YAxis
                dataKey="points"
                domain={[0, parseInt(maxBonusValue) + 20]}
                type="number"
              />

              <Line type="linear" dataKey="points" stroke="#0028a5" />

              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const time = payload[0].payload.time
                    const points = payload[0].payload.points

                    return (
                      <div className="border-primary-100 rounded border border-solid bg-white p-2 text-gray-600">
                        <div className="font-bold">
                          {payload[0].payload.windowStart}
                        </div>
                        <div>
                          {t('manage.sessionForms.liveQuizAnswerTime', {
                            answerTime: time,
                          })}{' '}
                        </div>
                        <div>
                          {t('manage.sessionForms.liveQuizTotalAwardedPoints', {
                            totalPoints: points,
                          })}
                        </div>
                      </div>
                    )
                  }

                  return null
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Modal>
  )
}

export default AdvancedLiveQuizSettings
