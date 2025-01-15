import { faBook, faGears } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import { Button, FormikNumberField, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import { twMerge } from 'tailwind-merge'

function AdvancedLiveQuizSettings({
  multiplier,
  defaultPointsValue,
  correctPointsValue,
  maxBonusValue,
  timeToZeroValue,
  showError,
}: {
  multiplier: string
  defaultPointsValue: string
  correctPointsValue: string
  maxBonusValue: string
  timeToZeroValue: string
  showError: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const multiplierValue = parseInt(multiplier, 10)
  const defaultPoints = parseInt(defaultPointsValue, 10) ?? LQ_DEFAULT_POINTS
  const defaultCorrectPoints =
    parseInt(correctPointsValue, 10) ?? LQ_DEFAULT_CORRECT_POINTS

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button
          basic
          onClick={() => setOpen(true)}
          data={{ cy: 'live-quiz-advanced-settings' }}
        >
          <FontAwesomeIcon
            icon={faGears}
            className={twMerge(
              'hover:text-primary-100',
              showError && 'text-red-600 hover:text-red-700'
            )}
          />
        </Button>
      }
      title={t('manage.activityWizard.liveQuizAdvancedSettings')}
      className={{ content: '!w-full max-w-[60rem] !pb-5' }}
      dataCloseButton={{ cy: 'live-quiz-advanced-settings-close' }}
      hideCloseButton={showError}
      escapeDisabled={showError}
    >
      <div className="mb-3">
        {t.rich('manage.activityWizard.liveQuizPointsExplanation', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/gamification/grading_logic/"
              target="_blank"
              rel="noreferrer"
              className="text-primary-100 hover:underline"
            >
              <FontAwesomeIcon icon={faBook} className="ml-1 mr-1.5" />
              {text}
            </a>
          ),
        })}
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:gap-0">
        <div className="w-full md:mr-8 md:w-1/2">
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="defaultPoints"
            label={t('manage.activityWizard.liveQuizDefaultPoints')}
            tooltip={t('manage.activityWizard.liveQuizDefaultPointsTooltip', {
              defaultValue: LQ_DEFAULT_POINTS,
            })}
            data={{
              cy: 'live-quiz-default-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="defaultCorrectPoints"
            label={t('manage.activityWizard.liveQuizDefaultCorrectPoints')}
            tooltip={t(
              'manage.activityWizard.liveQuizDefaultCorrectPointsTooltip',
              {
                defaultValue: LQ_DEFAULT_CORRECT_POINTS,
              }
            )}
            data={{
              cy: 'live-quiz-default-correct-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="maxBonusPoints"
            label={t('manage.activityWizard.liveQuizMaxBonusPoints')}
            tooltip={t('manage.activityWizard.liveQuizMaxBonusPointsTooltip', {
              defaultValue: LQ_MAX_BONUS_POINTS,
            })}
            data={{
              cy: 'live-quiz-max-bonus-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="timeToZeroBonus"
            label={t('manage.activityWizard.liveQuizTimeToZeroBonus')}
            tooltip={t('manage.activityWizard.liveQuizTimeToZeroBonusTooltip', {
              defaultValue: LQ_TIME_TO_ZERO_BONUS,
            })}
            data={{
              cy: 'live-quiz-time-to-zero-bonus',
            }}
          />
        </div>
        <div className="mt-4 w-full md:w-1/2">
          <ResponsiveContainer className="mb-4" height={245}>
            <LineChart
              data={[
                {
                  time: 0,
                  correctPoints:
                    defaultPoints +
                    multiplierValue *
                      (defaultCorrectPoints +
                        (parseInt(maxBonusValue, 10) ?? 0)),
                  wrongPoints: defaultPoints,
                },
                {
                  time: parseInt(timeToZeroValue, 10) ?? 0,
                  correctPoints:
                    defaultPoints + multiplierValue * defaultCorrectPoints,
                  wrongPoints: defaultPoints,
                },
                {
                  time: 2 * (parseInt(timeToZeroValue, 10) ?? 0),
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
                dataKey="points"
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
                payload={[
                  {
                    value: t(
                      'manage.activityWizard.liveQuizCorrectAnswersPoints'
                    ),
                    type: 'line',
                    color: '#006400',
                  },
                  {
                    value: t(
                      'manage.activityWizard.liveQuizIncorrectAnswersPoints'
                    ),
                    type: 'line',
                    color: '#ed2939',
                  },
                ]}
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
        </div>
      </div>
    </Modal>
  )
}

export default AdvancedLiveQuizSettings
