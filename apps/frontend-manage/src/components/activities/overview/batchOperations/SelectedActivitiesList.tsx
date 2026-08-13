import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import {
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableRow,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import ObjectPermissionLevel from '../../../sharing/ObjectPermissionLevel'

function SelectedActivitiesList({
  selectedActivities,
  affectedActivities,
}: {
  selectedActivities: ActivityInfo[]
  affectedActivities: (ActivityInfo & {
    actionsApplied: boolean
    reasons: string[]
  })[]
}) {
  const t = useTranslations()

  // check if user has owner / admin permissions on all activities
  const allAdminPermissions = useMemo(
    () => selectedActivities.every((activity) => activity.isManager),
    [selectedActivities]
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <ShadcnTable className="mt-2">
        <ShadcnTableBody>
          {affectedActivities.map((activity) => (
            <ShadcnTableRow
              key={activity.id}
              data-cy={`activity-batch-entry-${activity.name}`}
            >
              <ShadcnTableCell
                className={twMerge(
                  'line-clamp-1 h-7 whitespace-normal',
                  !activity.actionsApplied && 'text-black/30'
                )}
              >
                {activity.name}
              </ShadcnTableCell>
              {!allAdminPermissions ? (
                !activity.isOwner ? (
                  <ShadcnTableCell className="w-5.5 px-0 text-center">
                    <ObjectPermissionLevel
                      iconOnly
                      objectName={activity.name}
                      permissionLevel={activity.permissionLevel!}
                    />
                  </ShadcnTableCell>
                ) : (
                  <ShadcnTableCell className="w-5.5" />
                )
              ) : null}
              <ShadcnTableCell className="w-5.5 px-0 text-center">
                {activity.actionsApplied ? (
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-green-700"
                    data-cy={`activity-batch-check-${activity.name}`}
                  />
                ) : (
                  <Tooltip
                    tooltip={
                      <>
                        <div>
                          {t('manage.activities.batchNotApplicableExplanation')}
                        </div>
                        <ul className="list-disc pl-4">
                          {activity.reasons.map((reason) => (
                            <li key={reason} className="mt-0.5">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </>
                    }
                  >
                    <FontAwesomeIcon
                      icon={faX}
                      className="text-red-600"
                      data-cy={`activity-batch-x-${activity.name}`}
                    />
                  </Tooltip>
                )}
              </ShadcnTableCell>
            </ShadcnTableRow>
          ))}
        </ShadcnTableBody>
      </ShadcnTable>
    </div>
  )
}

export default SelectedActivitiesList
