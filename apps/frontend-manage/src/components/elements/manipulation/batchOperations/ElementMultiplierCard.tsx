import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { BatchOperationActions } from '../types'

function ElementMultiplierCard({
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
        'gap-1 px-4 py-3',
        typeof selectedActions.multiplier !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('manage.questionPool.modifyMultiplier')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={typeof selectedActions.multiplier !== 'undefined'}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...prev,
                archive: false,
                unarchive: false,
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

export default ElementMultiplierCard
