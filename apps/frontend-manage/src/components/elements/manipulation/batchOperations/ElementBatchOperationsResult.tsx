import {
  faCheck,
  faMinus,
  faTriangleExclamation,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type ElementBatchSharingOutcome,
  ElementBatchSharingReason,
  ElementBatchSharingStatus,
  ElementBatchSharingTargetError,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { ElementBatchExecutionResult } from './types'

function UpdateResultNotice({
  result,
}: {
  result: Exclude<
    ElementBatchExecutionResult['update'],
    { status: 'NOT_REQUESTED' }
  >
}) {
  const t = useTranslations()
  const isSkipped = result.status === 'SKIPPED'
  const isSuccess = result.status === 'SUCCEEDED'
  const label = isSkipped
    ? t('manage.questionPool.batchUpdateResultSkipped')
    : result.status === 'FAILED'
      ? t('manage.questionPool.batchUpdateResultFailed')
      : isSuccess
        ? t('manage.questionPool.batchUpdateResultSuccess')
        : t('manage.questionPool.batchUpdateResultPartial', {
            updated: result.updatedCount,
            total: result.expectedCount,
          })

  return (
    <div
      className={twMerge(
        'rounded border px-3 py-2 text-sm',
        isSkipped
          ? 'border-orange-200 bg-orange-50 text-orange-800'
          : isSuccess
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
      )}
      data-cy="element-batch-update-result"
    >
      <FontAwesomeIcon
        icon={isSkipped ? faMinus : isSuccess ? faCheck : faX}
        className="mr-2"
      />
      {label}
    </div>
  )
}

function SharingOutcomeRow({
  outcome,
  elementName,
}: {
  outcome: ElementBatchSharingOutcome
  elementName: string
}) {
  const t = useTranslations()
  const shared = outcome.status === ElementBatchSharingStatus.Shared
  const label = shared
    ? t('manage.questionPool.batchSharingResultShared')
    : outcome.reason === ElementBatchSharingReason.InsufficientPermission
      ? t('manage.questionPool.batchSharingResultSkippedInsufficientPermission')
      : outcome.reason === ElementBatchSharingReason.ElementNotFoundOrDeleted
        ? t('manage.questionPool.batchSharingResultElementUnavailable')
        : outcome.reason === ElementBatchSharingReason.SharingFailed
          ? t('manage.questionPool.batchSharingResultFailed')
          : t('manage.questionPool.batchSharingResultNotProcessed')

  return (
    <ShadcnTableRow data-cy={`element-batch-sharing-result-${elementName}`}>
      <ShadcnTableCell>{elementName}</ShadcnTableCell>
      <ShadcnTableCell
        className={twMerge(
          'text-right',
          shared ? 'text-green-700' : 'text-red-700'
        )}
      >
        <FontAwesomeIcon icon={shared ? faCheck : faX} className="mr-2" />
        {label}
      </ShadcnTableCell>
    </ShadcnTableRow>
  )
}

function ElementBatchOperationsResult({
  result,
}: {
  result: ElementBatchExecutionResult
}) {
  const t = useTranslations()
  const selectedElements = new Map(
    result.selectedElements.map((element) => [element.id, element])
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
    <div
      className="flex flex-col gap-4"
      data-cy="element-batch-result"
      role="status"
      aria-live="polite"
    >
      <div>
        <h3 className="font-bold">
          {t('manage.questionPool.batchOperationsResult')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {t('manage.questionPool.batchOperationsResultDescription')}
        </p>
      </div>

      {result.update.status !== 'NOT_REQUESTED' ? (
        <UpdateResultNotice result={result.update} />
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
              <ShadcnTableHeader>
                <ShadcnTableRow>
                  <ShadcnTableHead>
                    {t('manage.questionPool.batchElementName')}
                  </ShadcnTableHead>
                  <ShadcnTableHead>
                    {t('manage.questionPool.batchSharingResult')}
                  </ShadcnTableHead>
                </ShadcnTableRow>
              </ShadcnTableHeader>
              <ShadcnTableBody>
                {sharingOutcomes.map((outcome) => {
                  const element = selectedElements.get(outcome.elementId)
                  const elementName = element?.name ?? String(outcome.elementId)
                  return (
                    <SharingOutcomeRow
                      key={outcome.elementId}
                      outcome={outcome}
                      elementName={elementName}
                    />
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
