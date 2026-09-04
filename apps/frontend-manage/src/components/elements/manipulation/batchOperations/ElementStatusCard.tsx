import { ElementStatus } from '@klicker-uzh/graphql/dist/ops'
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
import { ElementBatchOperationActions } from '../types'
import useStatusOptions from '../useStatusOptions'

function ElementStatusCard({
  selectedActions,
  setSelectedActions,
}: {
  selectedActions: ElementBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ElementBatchOperationActions>>
}) {
  const t = useTranslations()
  const statusOptions = useStatusOptions()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3',
        typeof selectedActions.status !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('manage.questionPool.modifyStatus')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={typeof selectedActions.status !== 'undefined'}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...prev,
                archive: false,
                unarchive: false,
                status:
                  typeof prev.status !== 'undefined'
                    ? undefined
                    : ElementStatus.Draft,
              }))
            }}
            data={{ cy: 'status-checkbox' }}
          />
          <Select
            value={selectedActions.status ?? ElementStatus.Draft}
            items={statusOptions}
            onChange={(value) => {
              setSelectedActions((prev) => ({
                ...prev,
                status: value as ElementStatus,
              }))
            }}
            className={{ root: 'h-8 w-44', trigger: 'h-8' }}
            data={{ cy: 'element-status-select' }}
            disabled={typeof selectedActions.status === 'undefined'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default ElementStatusCard
