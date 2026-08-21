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

function getMultiplierValue(multiplier?: string) {
  return multiplier && multiplier !== '' ? parseInt(multiplier, 10) : null
}

function isSuccessful(
  updateResult: ElementBatchUpdateExecutionResult,
  sharingResult: ElementBatchSharingExecutionResult,
  expectedSharingCount: number
) {
  const updateSuccessful =
    updateResult.status === 'NOT_REQUESTED' ||
    updateResult.status === 'SUCCEEDED'
  const sharingSuccessful =
    sharingResult.status === 'NOT_REQUESTED' ||
    (sharingResult.status === 'COMPLETED' &&
      !sharingResult.response.targetError &&
      sharingResult.response.outcomes.length === expectedSharingCount &&
      sharingResult.response.outcomes.every(
        (outcome) => outcome.status === ElementBatchSharingStatus.Shared
      ))

  return updateSuccessful && sharingSuccessful
}

function useElementBatchExecution({
  selectionSnapshot,
  updateElementIds,
  selectedActions,
  updatesConfigured,
  refetchElements,
  resetSelectedElements,
  onClose,
  setExecutionResult,
}: {
  selectionSnapshot: Element[]
  updateElementIds: Element['id'][]
  selectedActions: ElementBatchOperationActions
  updatesConfigured: boolean
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

  async function runUpdate(): Promise<ElementBatchUpdateExecutionResult> {
    if (!updatesConfigured) return { status: 'NOT_REQUESTED' }
    if (updateElementIds.length === 0) return { status: 'SKIPPED' }

    try {
      const { data } = await applyElementBatchOperations({
        variables: {
          elementIds: updateElementIds,
          archive: selectedActions.archive,
          unarchive: selectedActions.unarchive,
          status: selectedActions.status ?? undefined,
          multiplier: getMultiplierValue(selectedActions.multiplier),
          basePoints: selectedActions.basePoints ?? undefined,
          updateInstances: selectedActions.updateInstances,
          updateTemplateInstances: selectedActions.updateTemplateInstances,
        },
      })
      const updatedCount = data?.applyElementBatchOperations
      return typeof updatedCount === 'number'
        ? {
            status:
              updatedCount === updateElementIds.length
                ? 'SUCCEEDED'
                : 'PARTIAL',
            expectedCount: updateElementIds.length,
            updatedCount,
          }
        : { status: 'FAILED' }
    } catch (error) {
      console.error(error)
      return { status: 'FAILED' }
    }
  }

  async function runSharing(
    sharingValues: ElementBatchSharingFormValues
  ): Promise<ElementBatchSharingExecutionResult> {
    if (!sharingValues.enabled) return { status: 'NOT_REQUESTED' }

    try {
      const { data } = await shareElementsBatch({
        variables: {
          elementIds: selectionSnapshot.map((element) => element.id),
          permissionLevel: sharingValues.permissionLevel,
          shortnameOrEmail: sharingValues.shortnameOrEmail.trim() || undefined,
          userGroupId: sharingValues.userGroupId?.trim()
            ? parseInt(sharingValues.userGroupId, 10)
            : undefined,
        },
      })
      return data?.shareElementsBatch
        ? { status: 'COMPLETED', response: data.shareElementsBatch }
        : { status: 'REQUEST_FAILED' }
    } catch (error) {
      console.error(error)
      return { status: 'REQUEST_FAILED' }
    }
  }

  return async function execute(sharingValues: ElementBatchSharingFormValues) {
    const updateResult = await runUpdate()
    const sharingResult = await runSharing(sharingValues)

    let refreshFailed = false
    try {
      await refetchElements()
    } catch (error) {
      console.error(error)
      refreshFailed = true
    }

    if (
      isSuccessful(updateResult, sharingResult, selectionSnapshot.length) &&
      !refreshFailed
    ) {
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
