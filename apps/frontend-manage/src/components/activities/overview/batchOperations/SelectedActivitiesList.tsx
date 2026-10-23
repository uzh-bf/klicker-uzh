import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@uzh-bf/design-system/primitives'
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
      <Table className="mt-2">
        <TableBody>
          {affectedActivities.map((activity) => (
            <TableRow
              key={activity.id}
              data-cy={`activity-batch-entry-${activity.name}`}
            >
              <TableCell
                className={twMerge(
                  'line-clamp-1 h-7 whitespace-normal',
                  !activity.actionsApplied && 'text-black/30'
                )}
              >
                {activity.name}
              </TableCell>
              {!allAdminPermissions ? (
                !activity.isOwner ? (
                  <TableCell className="w-5.5 px-0 text-center">
                    <ObjectPermissionLevel
                      iconOnly
                      objectName={activity.name}
                      permissionLevel={activity.permissionLevel!}
                    />
                  </TableCell>
                ) : (
                  <TableCell className="w-5.5" />
                )
              ) : null}
              <TableCell className="w-5.5 px-0 text-center">
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
                          {activity.reasons.map((reason, idx) => (
                            <li key={idx} className="mt-0.5">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default SelectedActivitiesList
