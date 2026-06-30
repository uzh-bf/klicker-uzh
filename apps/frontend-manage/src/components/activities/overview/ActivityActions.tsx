import { faEllipsis, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import type { ActivityType } from '../../../lib/constants/activityEnums'
import { ActivityAction } from '../actions/useAvailableActions'

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
  const prepareMenuActions = useCallback(() => {
    availableActions.forEach((action) => action.onMenuOpen?.())
  }, [availableActions])

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

      <Dropdown
        items={[
          {
            label: t('manage.activities.activityInformation'),
            icon: faInfoCircle,
            className: '',
            onClick: () => openActivityDetailsModal(),
            data: { cy: `activity-information-${activityName}` },
          },
          ...availableActions.slice(1),
        ].map((action) => ({
          id: action.label,
          label: (
            <div
              className={`flex cursor-pointer items-center rounded px-1.5 py-0.5 ${
                action.className ?? ''
              }`}
            >
              <FontAwesomeIcon icon={action.icon} className="mr-2.5 h-4 w-4" />
              {action.label}
            </div>
          ),
          onClick: action.onClick,
          data: action.data,
        }))}
        trigger={
          <span
            className="flex"
            onFocus={prepareMenuActions}
            onMouseEnter={prepareMenuActions}
            onPointerDown={prepareMenuActions}
          >
            <FontAwesomeIcon icon={faEllipsis} />
          </span>
        }
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
