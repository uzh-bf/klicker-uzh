import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { ModalLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import ActivityLog from './ActivityLog'

interface ActivityLogDialogProps {
  // the ID of the object to fetch activity for
  objectId: string | number
  // the type of object (Element, Course, etc.)
  objectType: ObjectType
  // controlled open state
  open: boolean
  // callback for open state change
  onOpenChange: Dispatch<SetStateAction<boolean>>
}

function ActivityLogDialog({
  objectId,
  objectType,
  open,
  onOpenChange,
}: ActivityLogDialogProps) {
  const t = useTranslations()

  return (
    <ModalLegacy
      asPortal={false}
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('shared.activity.title')}
      data={{ cy: 'activity-log-dialog' }}
      dataCloseButton={{ cy: 'close-activity-log' }}
      className={{
        content: 'max-w-3xl',
      }}
    >
      <ActivityLog visible={open} objectId={objectId} objectType={objectType} />
    </ModalLegacy>
  )
}

export default ActivityLogDialog
