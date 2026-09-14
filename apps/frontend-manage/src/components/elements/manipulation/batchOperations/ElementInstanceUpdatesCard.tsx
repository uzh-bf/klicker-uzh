import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Switch,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { ElementBatchOperationActions } from '../types'

function ElementInstanceUpdatesCard({
  selectedActions,
  setSelectedActions,
}: {
  selectedActions: ElementBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ElementBatchOperationActions>>
}) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3 lg:col-span-2',
        selectedActions.updateInstances && 'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="flex flex-row items-center gap-3 font-normal">
          {t('manage.questionPool.activityUpdates')}
          <Tooltip tooltip={t('manage.questionPool.updateActivitiesBatchInfo')}>
            <FontAwesomeIcon
              size="lg"
              icon={faQuestionCircle}
              className="text-primary-60"
            />
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="batch-update-instances"
              checked={selectedActions.updateInstances ?? false}
              onCheckedChange={(checked) => {
                setSelectedActions((prev) => ({
                  ...prev,
                  updateInstances: checked,
                  updateTemplateInstances: !checked
                    ? false
                    : prev.updateTemplateInstances, // template updates can only be enabled if instance updates are enabled
                }))
              }}
              data={{ cy: 'instance-updates-switch' }}
            />
            <label
              htmlFor="batch-update-instances"
              className="text-sm text-gray-600"
            >
              {t('manage.questionPool.batchUpdateInstancesConsequence')}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="batch-update-template-instances"
              disabled={!selectedActions.updateInstances}
              checked={selectedActions.updateTemplateInstances ?? false}
              onCheckedChange={(checked) => {
                setSelectedActions((prev) => ({
                  ...prev,
                  updateTemplateInstances: checked,
                }))
              }}
              data={{ cy: 'template-updates-switch' }}
            />
            <label
              htmlFor="batch-update-template-instances"
              className={twMerge(
                'text-sm text-gray-600',
                !selectedActions.updateInstances && 'text-gray-400'
              )}
            >
              {t('manage.questionPool.batchUpdateTemplateInstancesConsequence')}
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ElementInstanceUpdatesCard
