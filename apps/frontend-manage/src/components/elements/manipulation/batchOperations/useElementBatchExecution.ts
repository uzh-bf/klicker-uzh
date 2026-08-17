import { useMutation } from '@apollo/client'
import {
  ApplyElementBatchOperationsDocument,
  type Element,
  ElementBatchSharingStatus,
  ShareElementsBatchDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ElementBatchOperationActions } from '../types'
import type {
  ElementBatchExecutionResult,
  ElementBatchSharingExecutionResult,
  ElementBatchSharingFormValues,
  ElementBatchUpdateExecutionResult,
} from './types'

type AffectedElement = Pick<Element, 'id'> & { actionsApplied: boolean }

function useElementBatchExecution({
  selectionSnapshot,
  affectedElements,
  selectedActions,
  updatesConfigured,
  numOfUpdatedElements,
  refetchElements,
  resetSelectedElements,
  onClose,
  setExecutionResult,
}: {
  selectionSnapshot: Element[]
  affectedElements: AffectedElement[]
  selectedActions: ElementBatchOperationActions
  updatesConfigured: boolean
  numOfUpdatedElements: number
  refetchElements: () => Promise<void>
  resetSelectedElements: () => void
  onClose: () => void
  setExecutionResult: Dispatch<
    SetStateAction<ElementBatchExecutionResult | undefined>
  >
}) {
  const t = useTranslations()
  const [applyElementBatchOperations] = useMutation(
    ApplyElementBatchOperationsDocument
  )
  const [shareElementsBatch] = useMutation(ShareElementsBatchDocument)

  return async function execute(sharingValues: ElementBatchSharingFormValues) {
    let updateResult: ElementBatchUpdateExecutionResult = {
      status: 'NOT_REQUESTED',
    }
    let sharingResult: ElementBatchSharingExecutionResult = {
      status: 'NOT_REQUESTED',
    }

    if (updatesConfigured && numOfUpdatedElements === 0) {
      updateResult = { status: 'SKIPPED' }
    } else if (updatesConfigured) {
      try {
        const { data } = await applyElementBatchOperations({
          variables: {
            elementIds: affectedElements
              .filter((element) => element.actionsApplied)
              .map((element) => element.id),
            archive: selectedActions.archive,
            unarchive: selectedActions.unarchive,
            status: selectedActions.status ?? undefined,
            multiplier:
              typeof selectedActions.multiplier !== 'undefined' &&
              selectedActions.multiplier !== ''
                ? parseInt(selectedActions.multiplier, 10)
                : null,
            basePoints: selectedActions.basePoints ?? undefined,
            updateInstances: selectedActions.updateInstances,
            updateTemplateInstances: selectedActions.updateTemplateInstances,
          },
        })
        const updatedCount = data?.applyElementBatchOperations
        updateResult =
          typeof updatedCount === 'number'
            ? {
                status:
                  updatedCount === numOfUpdatedElements
                    ? 'SUCCEEDED'
                    : 'PARTIAL',
                expectedCount: numOfUpdatedElements,
                updatedCount,
              }
            : { status: 'FAILED' }
      } catch (error) {
        console.error(error)
        updateResult = { status: 'FAILED' }
      }
    }

    if (sharingValues.enabled) {
      const userGroupId = sharingValues.userGroupId?.trim()
      try {
        const { data } = await shareElementsBatch({
          variables: {
            elementIds: selectionSnapshot.map((element) => element.id),
            permissionLevel: sharingValues.permissionLevel,
            shortnameOrEmail:
              sharingValues.shortnameOrEmail.trim() || undefined,
            userGroupId: userGroupId ? parseInt(userGroupId, 10) : undefined,
          },
        })
        sharingResult = data?.shareElementsBatch
          ? { status: 'COMPLETED', response: data.shareElementsBatch }
          : { status: 'REQUEST_FAILED' }
      } catch (error) {
        console.error(error)
        sharingResult = { status: 'REQUEST_FAILED' }
      }
    }

    let refreshFailed = false
    try {
      await refetchElements()
    } catch (error) {
      console.error(error)
      refreshFailed = true
    }

    const updateSuccessful =
      updateResult.status === 'NOT_REQUESTED' ||
      updateResult.status === 'SUCCEEDED'
    const sharingSuccessful =
      sharingResult.status === 'NOT_REQUESTED' ||
      (sharingResult.status === 'COMPLETED' &&
        !sharingResult.response.targetError &&
        sharingResult.response.outcomes.length === selectionSnapshot.length &&
        sharingResult.response.outcomes.every(
          (outcome) => outcome.status === ElementBatchSharingStatus.Shared
        ))

    if (updateSuccessful && sharingSuccessful && !refreshFailed) {
      resetSelectedElements()
      toast({
        type: 'success',
        message: t('manage.questionPool.batchOperationSuccess'),
        options: { duration: 3000 },
      })
      onClose()
      return
    }

    setExecutionResult({
      selectedElements: selectionSnapshot.map((element) => ({
        id: element.id,
        name: element.name,
      })),
      update: updateResult,
      sharing: sharingResult,
      refreshFailed,
    })
  }
}

export default useElementBatchExecution
