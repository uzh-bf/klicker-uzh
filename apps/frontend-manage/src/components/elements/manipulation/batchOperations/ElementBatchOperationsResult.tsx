import {
  faCheck,
  faMinus,
  faTriangleExclamation,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementBatchSharingReason,
  ElementBatchSharingStatus,
  ElementBatchSharingTargetError,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableRow,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ElementBatchExecutionResult } from './types'

function ElementBatchOperationsResult({
  result,
}: {
  result: ElementBatchExecutionResult
}) {
  const t = useTranslations()
  const selectedElements = useMemo(
    () =>
      new Map(result.selectedElements.map((element) => [element.id, element])),
    [result.selectedElements]
  )
  const sharingOutcomes =
    result.sharing.status === 'COMPLETED'
      ? result.sharing.response.outcomes
      : []
  const targetError =
    result.sharing.status === 'COMPLETED'
      ? result.sharing.response.targetError
      : undefined

  return (
    <div className="flex flex-col gap-4" data-cy="element-batch-result">
      <div>
        <h3 className="font-bold">
          {t('manage.questionPool.batchOperationsResult')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {t('manage.questionPool.batchOperationsResultDescription')}
        </p>
      </div>

      {result.update.status !== 'NOT_REQUESTED' ? (
        <div
          className={twMerge(
            'rounded border px-3 py-2 text-sm',
            result.update.status === 'SKIPPED'
              ? 'border-orange-200 bg-orange-50 text-orange-800'
              : result.update.status === 'SUCCEEDED'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
          )}
          data-cy="element-batch-update-result"
        >
          <FontAwesomeIcon
            icon={
              result.update.status === 'SKIPPED'
                ? faMinus
                : result.update.status === 'SUCCEEDED'
                  ? faCheck
                  : faX
            }
            className="mr-2"
          />
          {result.update.status === 'SKIPPED'
            ? t('manage.questionPool.batchUpdateResultSkipped')
            : result.update.status === 'FAILED'
              ? t('manage.questionPool.batchUpdateResultFailed')
              : result.update.status === 'SUCCEEDED'
                ? t('manage.questionPool.batchUpdateResultSuccess')
                : t('manage.questionPool.batchUpdateResultPartial', {
                    updated: result.update.updatedCount,
                    total: result.update.expectedCount,
                  })}
        </div>
      ) : null}

      {result.sharing.status !== 'NOT_REQUESTED' ? (
        <div>
          <h4 className="mb-1 font-bold">
            {t('manage.questionPool.batchSharingResult')}
          </h4>
          {result.sharing.status === 'REQUEST_FAILED' ? (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {t('manage.questionPool.batchSharingRequestFailed')}
            </div>
          ) : targetError ? (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {targetError ===
              ElementBatchSharingTargetError.InvalidOrSelfTarget
                ? t('manage.questionPool.batchSharingTargetInvalidOrSelf')
                : t('manage.questionPool.batchSharingTargetGroupUnavailable')}
            </div>
          ) : null}
          {sharingOutcomes.length > 0 ? (
            <ShadcnTable>
              <ShadcnTableBody>
                {sharingOutcomes.map((outcome) => {
                  const element = selectedElements.get(outcome.elementId)
                  const elementName = element?.name ?? String(outcome.elementId)
                  const shared =
                    outcome.status === ElementBatchSharingStatus.Shared
                  let label = t(
                    'manage.questionPool.batchSharingResultNotProcessed'
                  )

                  if (shared) {
                    label = t('manage.questionPool.batchSharingResultShared')
                  } else if (
                    outcome.reason ===
                    ElementBatchSharingReason.InsufficientPermission
                  ) {
                    label = t(
                      'manage.questionPool.batchSharingResultSkippedInsufficientPermission'
                    )
                  } else if (
                    outcome.reason ===
                    ElementBatchSharingReason.ElementNotFoundOrDeleted
                  ) {
                    label = t(
                      'manage.questionPool.batchSharingResultElementUnavailable'
                    )
                  } else if (
                    outcome.reason === ElementBatchSharingReason.SharingFailed
                  ) {
                    label = t('manage.questionPool.batchSharingResultFailed')
                  }

                  return (
                    <ShadcnTableRow
                      key={outcome.elementId}
                      data-cy={`element-batch-sharing-result-${elementName}`}
                    >
                      <ShadcnTableCell>{elementName}</ShadcnTableCell>
                      <ShadcnTableCell
                        className={twMerge(
                          'text-right',
                          shared ? 'text-green-700' : 'text-red-700'
                        )}
                      >
                        <FontAwesomeIcon
                          icon={shared ? faCheck : faX}
                          className="mr-2"
                        />
                        {label}
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  )
                })}
              </ShadcnTableBody>
            </ShadcnTable>
          ) : null}
        </div>
      ) : null}

      {result.refreshFailed ? (
        <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
          {t('manage.questionPool.batchOperationsRefreshFailed')}
        </div>
      ) : null}
    </div>
  )
}

export default ElementBatchOperationsResult
