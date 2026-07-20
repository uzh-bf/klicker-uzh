import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  NumberField,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityBatchOperationActions } from './types'

interface ActivityLiveQuizPointsCardProps {
  selectedActions: ActivityBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ActivityBatchOperationActions>>
}

function ActivityLiveQuizPointsCardContent({
  pointsDisabled,
  selectedActions,
  setSelectedActions,
}: ActivityLiveQuizPointsCardProps & { pointsDisabled: boolean }) {
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
        <CardTitle className="flex w-full flex-row items-center justify-between font-normal">
          <span className={twMerge(pointsDisabled && 'opacity-50')}>
            {t('manage.activities.modifyLiveQuizPoints')}
          </span>
          {pointsDisabled && (
            <FontAwesomeIcon
              size="sm"
              icon={faLock}
              className="text-uzh-red-100"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              disabled={pointsDisabled}
              checked={typeof selectedActions.liveQuizPoints !== 'undefined'}
              onCheck={() => {
                setSelectedActions((prev) => ({
                  ...prev,
                  liveQuizPoints:
                    typeof prev.liveQuizPoints !== 'undefined'
                      ? undefined
                      : {
                          basePoints: LQ_DEFAULT_POINTS,
                          correctnessPoints: LQ_DEFAULT_CORRECT_POINTS,
                          bonusPoints: LQ_MAX_BONUS_POINTS,
                          bonusTime: LQ_TIME_TO_ZERO_BONUS,
                        },
                }))
              }}
              data={{ cy: 'live-quiz-points-checkbox' }}
            />
            <span className={twMerge(pointsDisabled && 'opacity-50')}>
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
                unit={t('shared.generic.pointsSmall')}
                value={selectedActions.liveQuizPoints.basePoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          basePoints: numValue >= 0 ? numValue : 0,
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
                unit={t('shared.generic.pointsSmall')}
                value={selectedActions.liveQuizPoints.correctnessPoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          correctnessPoints: numValue >= 0 ? numValue : 0,
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
                unit={t('shared.generic.pointsSmall')}
                value={selectedActions.liveQuizPoints.bonusPoints.toString()}
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          bonusPoints: numValue >= 0 ? numValue : 0,
                        }
                      : undefined,
                  }))
                }}
                className={{ input: 'h-8', unit: 'h-8' }}
                data={{ cy: 'bonus-points-input' }}
              />
              <NumberField
                required
                isTouched
                label={t('manage.activities.bonusTime')}
                labelType="small"
                precision={0}
                min={0}
                unit={t('shared.generic.seconds')}
                value={selectedActions.liveQuizPoints.bonusTime.toString()}
                error={
                  selectedActions.liveQuizPoints.bonusTime < 1
                    ? t('manage.activities.bonusTimeNonNegative')
                    : undefined
                }
                onChange={(value) => {
                  const numValue = parseInt(value, 10) || 0
                  setSelectedActions((prev) => ({
                    ...prev,
                    liveQuizPoints: prev.liveQuizPoints
                      ? {
                          ...prev.liveQuizPoints,
                          bonusTime: numValue >= 0 ? numValue : 0,
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

function ActivityLiveQuizPointsCard({
  selectedActions,
  setSelectedActions,
}: ActivityLiveQuizPointsCardProps) {
  const t = useTranslations()
  const pointsDisabled =
    !!selectedActions.course?.id &&
    !selectedActions.course.isGamificationEnabled &&
    !selectedActions.course.isAssessmentEnabled

  return pointsDisabled ? (
    <Tooltip
      delay={0}
      tooltip={t(
        'manage.activities.liveQuizPointsRequireGamifiedAssessmentCourse'
      )}
      className={{ trigger: 'w-full lg:col-span-2' }}
    >
      <ActivityLiveQuizPointsCardContent
        selectedActions={selectedActions}
        setSelectedActions={setSelectedActions}
        pointsDisabled={pointsDisabled}
      />
    </Tooltip>
  ) : (
    <ActivityLiveQuizPointsCardContent
      selectedActions={selectedActions}
      setSelectedActions={setSelectedActions}
      pointsDisabled={pointsDisabled}
    />
  )
}

export default ActivityLiveQuizPointsCard
