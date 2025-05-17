import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ActivityLogDialog from './ActivityLogDialog'

interface ActivityLogButtonProps {
  // The ID of the object to fetch activity for
  objectId: string | number
  // The type of object (Element, Course, etc.)
  objectType: ObjectType
  // Size variant of the button
  size?: 'sm' | 'md' | 'lg'
  // Whether to show the button as outline or solid
  variant?: 'solid' | 'outline'
  // Whether to show the tooltip
  showTooltip?: boolean
  // Optional class names for styling
  className?: string
}

/**
 * A reusable button that opens the activity log dialog for any object type
 */
function ActivityLogButton({
  objectId,
  objectType,
  size = 'md',
  variant = 'outline',
  showTooltip = true,
  className,
}: ActivityLogButtonProps) {
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)

  const button = (
    <Button
      className={{ root: className }}
      onClick={(e) => {
        if (e) {
          e.stopPropagation()
          e.preventDefault()
        }
        setIsOpen(true)
      }}
      data-cy="activity-log-button"
      size={size}
      variant={variant}
    >
      <FontAwesomeIcon className="h-4 w-4" icon={faMessage} />
    </Button>
  )

  return (
    <>
      {showTooltip ? (
        <Tooltip tooltip={t('shared.activity.tooltip')}>{button}</Tooltip>
      ) : (
        button
      )}

      <ActivityLogDialog
        objectId={objectId}
        objectType={objectType}
        trigger={<></>} // Empty trigger as we're controlling the dialog open state manually
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  )
}

export default ActivityLogButton
