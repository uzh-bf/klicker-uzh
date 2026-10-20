import { faCheck, faMinus, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@uzh-bf/design-system/primitives'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ObjectPermissionLevel from '../../../sharing/ObjectPermissionLevel'
import type { ElementBatchAffectedElement } from './deriveElementBatchEligibility'

function SelectedElementsList({
  affectedElements,
  updatesConfigured,
  sharingEnabled,
}: {
  affectedElements: ElementBatchAffectedElement[]
  updatesConfigured: boolean
  sharingEnabled: boolean
}) {
  const t = useTranslations()

  const allAdminPermissions = affectedElements.every(
    (element) => element.isManager
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead
              className="px-2 text-left"
              data-cy="batch-element-name-heading"
            >
              {t('manage.questionPool.batchElementName')}
            </TableHead>
            {!allAdminPermissions ? (
              <TableHead
                className="w-28 px-2 text-left"
                data-cy="batch-element-permission-heading"
              >
                {t('manage.questionPool.batchElementPermission')}
              </TableHead>
            ) : null}
            <TableHead
              className="w-28 px-2 text-center"
              data-cy="batch-element-update-heading"
            >
              {t('manage.questionPool.batchUpdateStatus')}
            </TableHead>
            {sharingEnabled ? (
              <TableHead
                className="w-28 px-2 text-center"
                data-cy="batch-element-sharing-heading"
              >
                {t('manage.questionPool.batchSharingStatus')}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {affectedElements.map((element) => (
            <TableRow
              key={element.id}
              data-cy={`element-batch-entry-${element.name}`}
            >
              <TableCell
                className={twMerge(
                  'line-clamp-1 h-7 whitespace-normal',
                  !element.actionsApplied &&
                    (!sharingEnabled || !element.sharingApplied) &&
                    'text-black/30'
                )}
              >
                {element.name}
              </TableCell>
              {!allAdminPermissions ? (
                !element.isOwner ? (
                  <TableCell className="w-28 px-2 text-center">
                    <ObjectPermissionLevel
                      iconOnly
                      objectName={element.name}
                      permissionLevel={element.permissionLevel!}
                    />
                  </TableCell>
                ) : (
                  <TableCell className="w-28 px-2" />
                )
              ) : null}
              <TableCell className="w-28 px-2 text-center">
                {!updatesConfigured ? (
                  <span
                    role="img"
                    aria-label={t(
                      'manage.questionPool.batchUpdateStatusInactive'
                    )}
                    data-cy={`element-batch-update-inactive-${element.name}`}
                  >
                    <FontAwesomeIcon
                      aria-hidden
                      icon={faMinus}
                      className="text-gray-400"
                    />
                  </span>
                ) : element.actionsApplied ? (
                  <span
                    role="img"
                    aria-label={t('manage.questionPool.actionApplies')}
                  >
                    <FontAwesomeIcon
                      aria-hidden
                      icon={faCheck}
                      className="text-green-700"
                      data-cy={`element-batch-check-${element.name}`}
                    />
                  </span>
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
                          {element.reasons.map((reason) => (
                            <li key={reason} className="mt-0.5">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </>
                    }
                  >
                    <button
                      type="button"
                      aria-label={`${element.name}: ${element.reasons.join('; ')}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                      data-cy={`element-batch-x-${element.name}`}
                    >
                      <FontAwesomeIcon
                        aria-hidden
                        icon={faX}
                        className="text-red-600"
                      />
                    </button>
                  </Tooltip>
                )}
              </TableCell>
              {sharingEnabled ? (
                <TableCell className="w-28 px-2 text-center">
                  {element.sharingApplied ? (
                    <span
                      role="img"
                      aria-label={t('manage.questionPool.batchSharingApplies')}
                    >
                      <FontAwesomeIcon
                        aria-hidden
                        icon={faCheck}
                        className="text-green-700"
                        data-cy={`element-batch-sharing-check-${element.name}`}
                      />
                    </span>
                  ) : (
                    <Tooltip
                      tooltip={
                        <>
                          <div>
                            {t(
                              'manage.questionPool.batchSharingNotApplicableExplanation'
                            )}
                          </div>
                          <ul className="list-disc pl-4">
                            {element.sharingReasons.map((reason) => (
                              <li key={reason} className="mt-0.5">
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </>
                      }
                    >
                      <button
                        type="button"
                        aria-label={`${element.name}: ${element.sharingReasons.join('; ')}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                        data-cy={`element-batch-sharing-x-${element.name}`}
                      >
                        <FontAwesomeIcon
                          aria-hidden
                          icon={faX}
                          className="text-red-600"
                        />
                      </button>
                    </Tooltip>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default SelectedElementsList
