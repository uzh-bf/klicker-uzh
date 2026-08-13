import { useMutation } from '@apollo/client'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ApplyElementBatchOperationsDocument,
  Element,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { isShallowEqual, omit } from 'remeda'
import { twMerge } from 'tailwind-merge'
import ElementArchiveCard from './batchOperations/ElementArchiveCard'
import ElementBasePointsCard from './batchOperations/ElementBasePointsCard'
import ElementBatchOperationsInfo from './batchOperations/ElementBatchOperationsInfo'
import ElementInstanceUpdatesCard from './batchOperations/ElementInstanceUpdatesCard'
import ElementMultiplierCard from './batchOperations/ElementMultiplierCard'
import ElementStatusCard from './batchOperations/ElementStatusCard'
import SelectedElementsList from './batchOperations/SelectedElementsList'
import {
  ElementBatchOperationActions,
  INITIAL_ELEMENT_BATCH_OPERATIONS,
} from './types'

function ElementBatchOperationsModal({
  selectedElements,
  onClose,
  resetSelectedElements,
  refetchElements,
}: {
  selectedElements: Element[]
  onClose: () => void
  resetSelectedElements: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const [affectedElements, setAffectedElements] = useState(
    selectedElements.map((element) => ({
      ...element,
      actionsApplied: true,
      reasons: [] as string[],
    }))
  )
  const [selectedActions, setSelectedActions] =
    useState<ElementBatchOperationActions>(INITIAL_ELEMENT_BATCH_OPERATIONS)

  // application function for element list batch operations
  const [applyElementBatchOperations, { loading: applying }] = useMutation(
    ApplyElementBatchOperationsDocument
  )

  // whenever the applied filters change, update the affected elements
  useEffect(() => {
    const updatedAffectedElements = selectedElements.map((element) => {
      let actionsApplied = true
      const reasons: string[] = []

      // archive / unarchive
      if (selectedActions.unarchive) {
        if (!element.isArchived) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchUnarchiveOnlyArchivedElements')
          )
        }
        if (element.isArchived && !element.isManager) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchUnarchiveOnlyManagerElements')
          )
        }
      } else if (selectedActions.archive) {
        if (element.isArchived) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchArchiveOnlyUnarchivedElements')
          )
        }
        if (!element.isManager) {
          actionsApplied = false
          reasons.push(t('manage.questionPool.batchArchiveOnlyManagerElements'))
        }
      }

      // multiplier modification
      if (selectedActions.multiplier) {
        if (!('options' in element && element.options.hasSampleSolution)) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchMultiplierOnlySampleSolution')
          )
        }
        if (!element.isEditor) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchMultiplierOnlyEditorElements')
          )
        }
      }

      // base points modification
      if (typeof selectedActions.basePoints !== 'undefined') {
        if (
          element.type === ElementType.Flashcard ||
          element.type === ElementType.Content
        ) {
          actionsApplied = false
          reasons.push(t('manage.questionPool.batchBasePointsOnlyQuestions'))
        }
        if (!element.isEditor) {
          actionsApplied = false
          reasons.push(
            t('manage.questionPool.batchBasePointsOnlyEditorElements')
          )
        }
      }

      return {
        ...element,
        actionsApplied,
        reasons,
      }
    })

    setAffectedElements(updatedAffectedElements)
  }, [selectedElements, selectedActions, t])

  const numOfUpdatedElements = useMemo(() => {
    return affectedElements.filter((element) => element.actionsApplied).length
  }, [affectedElements])

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.questionPool.batchOperationsElements')}
      className={{
        content: 'xl:w-220 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
      }}
      dataCloseButton={{ cy: 'close-batch-operations-modal' }}
    >
      <div className="flex h-auto min-h-0 flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
        <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-4 overflow-auto md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-2/5">
          <div className="text-sm">
            {t('manage.questionPool.selectedElementsDescription')}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <SelectedElementsList
              selectedElements={selectedElements}
              affectedElements={affectedElements}
            />
          </div>
        </div>
        <div className="w-full overflow-auto px-0.5 pb-2 md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-3/5">
          <div className="flex flex-row items-center gap-2.5">
            <div className="font-bold">
              {t('shared.generic.availableActions')}
            </div>
            <ElementBatchOperationsInfo />
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <ElementArchiveCard
              selectedActions={selectedActions}
              setSelectedActions={setSelectedActions}
            />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ElementStatusCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
              <ElementMultiplierCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
              <ElementBasePointsCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
              <ElementInstanceUpdatesCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
            </div>
            <div className="flex flex-row items-center gap-5 self-end">
              <span
                className={twMerge(
                  'text-sm text-green-700',
                  numOfUpdatedElements === 0 && 'text-red-600'
                )}
              >
                <FontAwesomeIcon
                  icon={numOfUpdatedElements === 0 ? faX : faCheck}
                  className="mr-1.5"
                />
                {numOfUpdatedElements === 0
                  ? t('manage.questionPool.noElementsWillBeUpdated')
                  : t('manage.questionPool.nElementsWillBeUpdated', {
                      number:
                        numOfUpdatedElements === selectedElements.length
                          ? numOfUpdatedElements
                          : `${numOfUpdatedElements}/${selectedElements.length}`,
                    })}
              </span>
              <Button
                primary
                disabled={
                  applying ||
                  numOfUpdatedElements === 0 ||
                  isShallowEqual(
                    omit(selectedActions, [
                      'updateInstances',
                      'updateTemplateInstances',
                    ]),
                    omit(INITIAL_ELEMENT_BATCH_OPERATIONS, [
                      'updateInstances',
                      'updateTemplateInstances',
                    ])
                  )
                }
                onClick={async () => {
                  try {
                    // submit the batch operations
                    const { data: res } = await applyElementBatchOperations({
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
                        updateTemplateInstances:
                          selectedActions.updateTemplateInstances,
                      },
                    })

                    // in case of success, reset the selected elements and refetch the elements
                    if (
                      res?.applyElementBatchOperations === numOfUpdatedElements
                    ) {
                      resetSelectedElements()
                      await refetchElements()
                      toast({
                        type: 'success',
                        message: t('manage.questionPool.batchOperationSuccess'),
                        options: { duration: 3000 },
                      })
                      onClose()
                    } else if (res?.applyElementBatchOperations !== 0) {
                      resetSelectedElements()
                      await refetchElements()
                      toast({
                        type: 'warning',
                        message: t(
                          'manage.questionPool.batchOperationPartialSuccess'
                        ),
                        options: { duration: 4500 },
                      })
                      onClose()
                    } else {
                      toast({
                        type: 'error',
                        message: t('manage.questionPool.batchOperationFailed'),
                        options: { duration: 5000 },
                      })
                    }
                  } catch (error) {
                    console.error(error)
                    toast({
                      type: 'error',
                      message: t('manage.questionPool.batchOperationFailed'),
                      options: { duration: 5000 },
                    })
                  }
                }}
                className={{ root: 'h-9' }}
                data={{ cy: 'apply-batch-operations' }}
              >
                {t('shared.generic.apply')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ElementBatchOperationsModal
