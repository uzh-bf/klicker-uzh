import { faEllipsis, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { SyntheticEvent } from 'react'
import { ActivityAction } from '../actions/useAvailableActions'

// the open menu is rendered into a portal, and react still routes its events
// through the component tree — so an activated menu entry reaches the wrapper
// below just like the trigger does. only events whose target really sits inside
// the wrapper come from the trigger itself.
function isFromTrigger(event: SyntheticEvent<HTMLElement>) {
  return event.currentTarget.contains(event.target as Node)
}

function ActivityActions({
  availableActions,
  activityId,
  activityName,
  activityType,
  openActivityDetailsModal,
  onMenuOpen,
}: {
  availableActions: ActivityAction[]
  activityId: string
  activityName: string
  activityType: ActivityType
  openActivityDetailsModal: () => void
  onMenuOpen?: () => void
}) {
  const t = useTranslations()

  const dropdownActions: ActivityAction[] = [
    {
      id: 'activityInformation',
      label: t('manage.activities.activityInformation'),
      icon: faInfoCircle,
      className: '',
      onClick: () => openActivityDetailsModal(),
      data: { cy: `activity-information-${activityName}` },
    },
    ...availableActions.slice(1),
  ]

  return (
    <div className="-mr-1 flex flex-row items-end gap-1">
      {availableActions.slice(0, 1).map((action) => {
        return (
          <Button
            basic
            key={`activity-${activityType}-${activityId}-${action.id}`}
            disabled={action.disabled}
            onClick={action.onClick}
            className={{
              root: 'text-primary-100 hover:text-primary-100 h-8 text-sm',
            }}
            data={action.data}
          >
            <Button.Icon icon={action.icon} />
            <Button.Label>{action.label}</Button.Label>
          </Button>
        )
      })}

      {/* the dropdown exposes no open callback, so any state its items need on
          open has to be observed from outside: events bubble up from the trigger
          button to this wrapper, while a handler placed on the trigger's own
          children would never see a keyboard event at all. the wrapper stays
          separate from the row so the adjacent action button cannot trigger it */}
      <span
        onPointerDown={(e) => {
          if (isFromTrigger(e)) {
            onMenuOpen?.()
          }
        }}
        onKeyDown={(e) => {
          if (isFromTrigger(e) && (e.key === 'Enter' || e.key === ' ')) {
            onMenuOpen?.()
          }
        }}
      >
        <Dropdown
          items={dropdownActions.map((action) => ({
            id: action.label,
            label: (
              <div
                className={`flex cursor-pointer items-center rounded px-1.5 py-0.5 ${
                  action.className ?? ''
                }`}
              >
                <FontAwesomeIcon
                  icon={action.icon}
                  className="mr-2.5 h-4 w-4"
                />
                {action.label}
              </div>
            ),
            onClick: action.onClick,
            disabled: action.disabled,
            tooltip: action.tooltip,
            data: action.data,
          }))}
          trigger={<FontAwesomeIcon icon={faEllipsis} />}
          data={{ cy: `actions-${activityType}-${activityName}` }}
          className={{
            viewport: 'z-20', // ensure that dropdown is shown above other elements on course overview
            item: 'py-0.5 text-sm',
            trigger: 'h-8 w-8 border-none bg-transparent text-sm',
          }}
        />
      </span>
    </div>
  )
}

export default ActivityActions
