import { faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Dropdown } from '@uzh-bf/design-system'
import { ActivityAction } from '../actions/useAvailableActions'
import ActivityActionButton from './ActivityActionButton'

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
    <div className="flex flex-row items-center gap-2">
      {availableActions.slice(0, 3).map((action) => {
        return (
          <ActivityActionButton
            key={`activity-${activityType}-${activityId}-${action.id}`}
            icon={action.icon}
            tooltip={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            data={action.data}
            className={action.className}
          />
        )
      })}

      {availableActions.length > 3 && (
        <Dropdown
          items={availableActions.slice(3).map((action) => ({
            label: (
              <div
                className={`flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100 ${
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
          trigger={
            <ActivityActionButton
              icon={faEllipsis}
              onClick={() => {}}
              data={{ cy: `actions-${activityType}-${activityName}` }}
            />
          }
          className={{
            viewport: 'z-20', // ensure that dropdown is shown above other elements on course overview
            item: 'py-0.5 text-sm',
          }}
        />
      )}
    </div>
  )
}

export default ActivityActions
