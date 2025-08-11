import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  NumberField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityBatchOperationActions } from './types'

function ActivityLiveQuizPointsCard({
  selectedActions,
  setSelectedActions,
}: {
  selectedActions: ActivityBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ActivityBatchOperationActions>>
}) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3 lg:col-span-2',
        typeof selectedActions.liveQuizPoints !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('manage.activities.modifyLiveQuizPoints')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={typeof selectedActions.liveQuizPoints !== 'undefined'}
              onCheck={() => {
                setSelectedActions((prev) => ({
                  ...prev,
                  liveQuizPoints:
                    typeof prev.liveQuizPoints !== 'undefined'
                      ? undefined
                      : {
                          basePoints: 10,
                          correctnessPoints: 30,
                          bonusPoints: 10,
                          bonusTimes: 5,
                        },
                }))
              }}
              data={{ cy: 'live-quiz-points-checkbox' }}
            />
            <span>
              {t('manage.activities.enableLiveQuizPointsModification')}
            </span>
          </div>
          {typeof selectedActions.liveQuizPoints !== 'undefined' && (
            <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 md:grid-cols-2">
              <NumberField
                required
                label={t('manage.general.basePointsDescription')}
                labelType="small"
                precision={0}
                min={0}
                unit="P."
                value={selectedActions.liveQuizPoints.basePoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          basePoints: numValue,
                        }
                      : undefined,
                  }))
                }}
                className={{ input: 'h-8', unit: 'h-8' }}
                data={{ cy: 'base-points-input' }}
              />
              <NumberField
                required
                label={t('manage.general.correctnessPointsDescription')}
                labelType="small"
                precision={0}
                min={0}
                unit="P."
                value={selectedActions.liveQuizPoints.correctnessPoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          correctnessPoints: numValue,
                        }
                      : undefined,
                  }))
                }}
                className={{ input: 'h-8', unit: 'h-8' }}
                data={{ cy: 'correctness-points-input' }}
              />
              <NumberField
                required
                label={t('manage.general.bonusPointsDescription')}
                labelType="small"
                precision={0}
                min={0}
                unit="P."
                value={selectedActions.liveQuizPoints.bonusPoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          bonusPoints: numValue,
                        }
                      : undefined,
                  }))
                }}
                className={{ input: 'h-8', unit: 'h-8' }}
                data={{ cy: 'bonus-points-input' }}
              />
              <NumberField
                required
                label={t('manage.activities.bonusTime')}
                labelType="small"
                precision={0}
                min={0}
                unit={t('shared.generic.seconds')}
                value={selectedActions.liveQuizPoints.bonusTimes.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          bonusTimes: numValue,
                        }
                      : undefined,
                  }))
                }}
                className={{ input: 'h-8', unit: 'h-8' }}
                data={{ cy: 'bonus-times-input' }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ActivityLiveQuizPointsCard
