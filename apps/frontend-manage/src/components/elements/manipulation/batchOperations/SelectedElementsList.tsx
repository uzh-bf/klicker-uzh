import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element } from '@klicker-uzh/graphql/dist/ops'
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

function SelectedElementsList({
  selectedElements,
  affectedElements,
}: {
  selectedElements: Element[]
  affectedElements: (Element & {
    actionsApplied: boolean
    reasons: string[]
  })[]
}) {
  const t = useTranslations()

  // check if user has owner / admin permissions on all elements
  const allAdminPermissions = useMemo(
    () => selectedElements.every((element) => element.isManager),
    [selectedElements]
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table className="mt-2">
        <TableBody>
          {affectedElements.map((element) => (
            <TableRow
              key={element.id}
              data-cy={`element-batch-entry-${element.name}`}
            >
              <TableCell
                className={twMerge(
                  'line-clamp-1 h-7 whitespace-normal',
                  !element.actionsApplied && 'text-black/30'
                )}
              >
                {element.name}
              </TableCell>
              {!allAdminPermissions ? (
                !element.isOwner ? (
                  <TableCell className="w-5.5 px-0 text-center">
                    <ObjectPermissionLevel
                      iconOnly
                      objectName={element.name}
                      permissionLevel={element.permissionLevel!}
                    />
                  </TableCell>
                ) : (
                  <TableCell className="w-5.5" />
                )
              ) : null}
              <TableCell className="w-5.5 px-0 text-center">
                {element.actionsApplied ? (
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-green-700"
                    data-cy={`element-batch-check-${element.name}`}
                  />
                ) : (
                  <Tooltip
                    tooltip={
                      <>
                        <div>
                          {t(
                            'manage.questionPool.batchNotApplicableExplanation'
                          )}
                        </div>
                        <ul className="list-disc pl-4">
                          {element.reasons.map((reason, idx) => (
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
                      data-cy={`element-batch-x-${element.name}`}
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

export default SelectedElementsList
