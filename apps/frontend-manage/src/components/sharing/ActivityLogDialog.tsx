import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityLog from './ActivityLog'

function ActivityLogDialog({
  objectId,
  objectType,
  open,
  onClose,
}: {
  objectId: string | number
  objectType: ObjectType
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      onClose={onClose}
      title={t('shared.activity.title')}
      data={{ cy: 'activity-log-dialog' }}
      dataCloseButton={{ cy: 'close-activity-log' }}
      className={{
        content: 'max-w-3xl, pb-2',
      }}
    >
      <ActivityLog visible={open} objectId={objectId} objectType={objectType} />
    </Modal>
  )
}

export default ActivityLogDialog
