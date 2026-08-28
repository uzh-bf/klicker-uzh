import { faCheck, faMinus, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  Tooltip,
} from '@uzh-bf/design-system'
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
      <ShadcnTable className="mt-2">
        <ShadcnTableHeader>
          <ShadcnTableRow>
            <ShadcnTableHead>
              <span className="sr-only">
                {t('manage.questionPool.batchElementName')}
              </span>
            </ShadcnTableHead>
            {!allAdminPermissions ? (
              <ShadcnTableHead className="w-5.5 px-0">
                <span className="sr-only">
                  {t('manage.questionPool.batchElementPermission')}
                </span>
              </ShadcnTableHead>
            ) : null}
            <ShadcnTableHead
              className="w-5.5 px-0 text-center"
              aria-disabled={!updatesConfigured}
            >
              <span className="sr-only">
                {updatesConfigured
                  ? t('manage.questionPool.batchUpdateStatus')
                  : t('manage.questionPool.batchUpdateStatusInactive')}
              </span>
              {!updatesConfigured ? (
                <FontAwesomeIcon
                  aria-hidden
                  icon={faMinus}
                  className="text-gray-400"
                />
              ) : null}
            </ShadcnTableHead>
            {sharingEnabled ? (
              <ShadcnTableHead className="w-5.5 px-0 text-center">
                <span className="sr-only">
                  {t('manage.questionPool.batchSharingStatus')}
                </span>
              </ShadcnTableHead>
            ) : null}
          </ShadcnTableRow>
        </ShadcnTableHeader>
        <ShadcnTableBody>
          {affectedElements.map((element) => (
            <ShadcnTableRow
              key={element.id}
              data-cy={`element-batch-entry-${element.name}`}
            >
              <ShadcnTableCell
                className={twMerge(
                  'line-clamp-1 h-7 whitespace-normal',
                  !element.actionsApplied &&
                    (!sharingEnabled || !element.sharingApplied) &&
                    'text-black/30'
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
              </ShadcnTableCell>
              {sharingEnabled ? (
                <ShadcnTableCell className="w-5.5 px-0 text-center">
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
                </ShadcnTableCell>
              ) : null}
            </ShadcnTableRow>
          ))}
        </ShadcnTableBody>
      </ShadcnTable>
    </div>
  )
}

export default SelectedElementsList
