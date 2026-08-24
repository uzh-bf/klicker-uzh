import { faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type ActivityBatchOperationActions,
  INITIAL_ACTIVITY_BATCH_OPERATIONS,
} from './types'

function ActivityDeletionCard({
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
        'gap-1 border-red-200 px-4 py-3',
        selectedActions.deleteActivities && 'ring-1 ring-red-600'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="flex items-center gap-2 font-normal text-red-700">
          <FontAwesomeIcon icon={faTrashCan} size="sm" />
          {t('manage.activities.deleteSelectedActivities')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <label
          htmlFor="delete-activities-checkbox"
          className="flex cursor-pointer items-start gap-2"
        >
          <Checkbox
            id="delete-activities-checkbox"
            checked={selectedActions.deleteActivities}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...INITIAL_ACTIVITY_BATCH_OPERATIONS,
                deleteActivities: !prev.deleteActivities,
              }))
            }}
            data={{ cy: 'delete-activities-checkbox' }}
          />
          <span className="text-sm">
            {t('manage.activities.batchDeleteDescription')}
          </span>
        </label>
      </CardContent>
    </Card>
  )
}

export default ActivityDeletionCard
