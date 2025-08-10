import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Switch,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { BatchOperationActions } from '../types'

function ElementBasePointsCard({
  selectedActions,
  setSelectedActions,
}: {
  selectedActions: BatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<BatchOperationActions>>
}) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3 lg:col-span-2',
        typeof selectedActions.basePoints !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('manage.questionPool.modifyBasePoints')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={typeof selectedActions.basePoints !== 'undefined'}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...prev,
                archive: false,
                unarchive: false,
                basePoints:
                  typeof prev.basePoints !== 'undefined' ? undefined : true,
              }))
            }}
            data={{ cy: 'base-points-checkbox' }}
          />
          <span className="text-sm text-gray-600">
            {t('manage.questionPool.awardBasePoints')}
          </span>
          <Switch
            checked={selectedActions.basePoints ?? true}
            onCheckedChange={(checked) => {
              setSelectedActions((prev) => ({
                ...prev,
                basePoints: checked,
              }))
            }}
            data={{ cy: 'base-points-switch' }}
            disabled={typeof selectedActions.basePoints === 'undefined'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default ElementBasePointsCard
