import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityBatchOperationActions } from './types'

interface ActivityMultiplierCardProps {
  selectedActions: ActivityBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ActivityBatchOperationActions>>
}

function ActivityMultiplierCardContent({
  multiplierDisabled,
  selectedActions,
  setSelectedActions,
}: ActivityMultiplierCardProps & {
  multiplierDisabled: boolean
}) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3',
        typeof selectedActions.multiplier !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="flex w-full flex-row items-center justify-between font-normal">
          <span className={twMerge(multiplierDisabled && 'opacity-50')}>
            {t('manage.activities.modifyMultiplier')}
          </span>
          {multiplierDisabled && (
            <FontAwesomeIcon
              size="sm"
              icon={faLock}
              className="text-uzh-red-100"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2">
          <Checkbox
            disabled={multiplierDisabled}
            checked={typeof selectedActions.multiplier !== 'undefined'}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...prev,
                multiplier:
                  typeof prev.multiplier !== 'undefined' ? undefined : '1',
              }))
            }}
            data={{ cy: 'multiplier-checkbox' }}
          />
          <Select
            value={selectedActions.multiplier ?? '1'}
            onChange={(value) => {
              setSelectedActions((prev) => ({
                ...prev,
                multiplier: value,
              }))
            }}
            items={[
              { label: t('manage.activityWizard.multiplier1'), value: '1' },
              { label: t('manage.activityWizard.multiplier2'), value: '2' },
              { label: t('manage.activityWizard.multiplier3'), value: '3' },
              { label: t('manage.activityWizard.multiplier4'), value: '4' },
            ]}
            data={{ cy: 'select-multiplier' }}
            className={{ root: 'h-8 w-44', trigger: 'h-8' }}
            disabled={typeof selectedActions.multiplier === 'undefined'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityMultiplierCard({
  selectedActions,
  setSelectedActions,
}: ActivityMultiplierCardProps) {
  const t = useTranslations()
  const multiplierDisabled =
    !!selectedActions.course &&
    !selectedActions.course.isGamificationEnabled &&
    !selectedActions.course.isAssessmentEnabled

  return multiplierDisabled ? (
    <Tooltip
      delay={0}
      tooltip={t(
        'manage.activities.multiplierRequiresGamifiedAssessmentCourse'
      )}
    >
      <ActivityMultiplierCardContent
        selectedActions={selectedActions}
        setSelectedActions={setSelectedActions}
        multiplierDisabled={multiplierDisabled}
      />
    </Tooltip>
  ) : (
    <ActivityMultiplierCardContent
      selectedActions={selectedActions}
      setSelectedActions={setSelectedActions}
      multiplierDisabled={multiplierDisabled}
    />
  )
}

export default ActivityMultiplierCard
