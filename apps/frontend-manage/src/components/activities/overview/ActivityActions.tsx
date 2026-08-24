import { faEllipsis, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ActivityAction } from '../actions/useAvailableActions'

function ActivityActions({
  availableActions,
  activityId,
  activityName,
  activityType,
  openActivityDetailsModal,
}: {
  availableActions: ActivityAction[]
  activityId: string
  activityName: string
  activityType: ActivityType
  openActivityDetailsModal: () => void
}) {
  const t = useTranslations()
  const activityInformationAction: ActivityAction = {
    id: 'activityInformation',
    label: t('manage.activities.activityInformation'),
    icon: faInfoCircle,
    onClick: () => openActivityDetailsModal(),
    data: { cy: `activity-information-${activityName}` },
  }

  return (
    <div className="-mr-1 flex flex-row items-end gap-1">
      {availableActions.slice(0, 1).map((action) => {
        const actionKey = `activity-${activityType}-${activityId}-${action.id}`
        const button = (
          <Button
            basic
            key={actionKey}
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

        return action.tooltip ? (
          <Tooltip
            key={actionKey}
            tooltip={action.tooltip}
            delay={0}
            className={{ tooltip: 'z-30' }}
          >
            {button}
          </Tooltip>
        ) : (
          button
        )
      })}

      <Dropdown
        items={[activityInformationAction, ...availableActions.slice(1)].map(
          (action) => ({
            id: action.id,
            disabled: action.disabled,
            tooltip: action.tooltip,
            label: (
              <div
                className={`flex items-center rounded px-1.5 py-0.5 ${
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
          })
        )}
        trigger={<FontAwesomeIcon icon={faEllipsis} />}
        data={{ cy: `actions-${activityType}-${activityName}` }}
        className={{
          viewport: 'z-20', // ensure that dropdown is shown above other elements on course overview
          item: 'py-0.5 text-sm',
          trigger: 'h-8 w-8 border-none bg-transparent text-sm',
        }}
      />
    </div>
  )
}

export default ActivityActions
