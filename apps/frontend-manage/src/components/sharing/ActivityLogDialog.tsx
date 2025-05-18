import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, ReactNode, SetStateAction, useState } from 'react'
import ActivityLog from './ActivityLog'

interface ActivityLogDialogProps {
  // The ID of the object to fetch activity for
  objectId: string | number
  // The type of object (Element, Course, etc.)
  objectType: ObjectType
  // The trigger element (button, icon, etc.) to open the dialog
  trigger?: ReactNode
  // Optional controlled open state
  open?: boolean
  // Optional callback for open state change
  onOpenChange?: Dispatch<SetStateAction<boolean>>
}

/**
 * A reusable modal component for displaying activity logs for different object types
 * This component handles the modal functionality and leverages the ActivityLog component for content
 */
function ActivityLogDialog({
  objectId,
  objectType,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ActivityLogDialogProps) {
  const t = useTranslations()
  const [internalOpen, setInternalOpen] = useState(false)

  // Use controlled or uncontrolled state based on props
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  // Handle closing the modal
  const handleClose = () => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(false)
    } else {
      setInternalOpen(false)
    }
  }

  // If a custom trigger is provided and we're in uncontrolled mode, add click handler
  const triggerElement =
    trigger && controlledOpen === undefined ? (
      <div onClick={() => setInternalOpen(true)}>{trigger}</div>
    ) : (
      trigger
    )

  return (
    <>
      {triggerElement}

      <Modal
        asPortal={false}
        open={isOpen}
        onClose={handleClose}
        title={t('shared.activity.title')}
        dataCloseButton={{ cy: 'close-activity-log' }}
        className={{
          content: 'max-w-3xl',
        }}
      >
        <ActivityLog
          visible={isOpen}
          objectId={objectId}
          objectType={objectType}
        />
      </Modal>
    </>
  )
}

export default ActivityLogDialog
