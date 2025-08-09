import { faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { ActivityAction } from '../actions/useAvailableActions'

function ActivityActions({
  availableActions,
  activityId,
  activityName,
  activityType,
}: {
  availableActions: ActivityAction[]
  activityId: string
  activityName: string
  activityType: ActivityType
}) {
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

      {availableActions.length > 1 && (
        <Dropdown
          items={availableActions.slice(1).map((action) => ({
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
      )}
    </div>
  )
}

export default ActivityActions
