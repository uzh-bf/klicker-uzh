import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element } from '@klicker-uzh/graphql/dist/ops'
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
      <ShadcnTable className="mt-2">
        <ShadcnTableBody>
          {affectedElements.map((element) => {
            const isAffected =
              affectedElements.find(
                (affectedElement) => affectedElement.id === element.id
              )?.actionsApplied ?? false

            return (
              <ShadcnTableRow
                key={element.id}
                data-cy={`element-batch-entry-${element.name}`}
              >
                <ShadcnTableCell
                  className={twMerge(
                    'line-clamp-1 h-7 whitespace-normal',
                    !isAffected && 'text-black/30'
                  )}
                >
                  {element.name}
                </ShadcnTableCell>
                {!allAdminPermissions ? (
                  !element.isOwner ? (
                    <ShadcnTableCell className="w-5.5 px-0 text-center">
                      <ObjectPermissionLevel
                        iconOnly
                        objectName={element.name}
                        permissionLevel={element.permissionLevel!}
                      />
                    </ShadcnTableCell>
                  ) : (
                    <ShadcnTableCell className="w-5.5" />
                  )
                ) : null}
                <ShadcnTableCell className="w-5.5 px-0 text-center">
                  {isAffected ? (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-green-600"
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
                </ShadcnTableCell>
              </ShadcnTableRow>
            )
          })}
        </ShadcnTableBody>
      </ShadcnTable>
    </div>
  )
}

export default SelectedElementsList
