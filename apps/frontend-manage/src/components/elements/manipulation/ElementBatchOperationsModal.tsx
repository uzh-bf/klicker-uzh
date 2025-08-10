import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { isShallowEqual } from 'remeda'
import { twMerge } from 'tailwind-merge'
import ElementArchiveCard from './batchOperations/ElementArchiveCard'
import ElementBasePointsCard from './batchOperations/ElementBasePointsCard'
import ElementBatchOperationsInfo from './batchOperations/ElementBatchOperationsInfo'
import ElementMultiplierCard from './batchOperations/ElementMultiplierCard'
import ElementStatusCard from './batchOperations/ElementStatusCard'
import SelectedElementsList from './batchOperations/SelectedElementsList'
import {
  BatchOperationActions,
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
    selectedElements.map((element) => element.id)
  )
  const [selectedActions, setSelectedActions] = useState<BatchOperationActions>(
    INITIAL_ELEMENT_BATCH_OPERATIONS
  )

  // whenever the applied filters change, update the affected elements
  useEffect(() => {
    let filtered = [...selectedElements]

    if (selectedActions.unarchive) {
      filtered = filtered.filter(
        (element) => element.isArchived && element.isManager
      )
    } else if (selectedActions.archive) {
      filtered = filtered.filter(
        (element) => !element.isArchived && element.isManager
      )
    }
    if (selectedActions.multiplier) {
      filtered = filtered.filter(
        (element) =>
          element.isEditor &&
          'options' in element &&
          element.options.hasSampleSolution
      )
    }
    if (typeof selectedActions.basePoints !== 'undefined') {
      filtered = filtered.filter(
        (element) =>
          element.isEditor &&
          element.type !== ElementType.Flashcard &&
          element.type !== ElementType.Content
      )
    }

    // return the filtered and mapped elements (unfiltered if no relevant action applied)
    setAffectedElements(filtered.map((element) => element.id))
  }, [selectedActions])

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.questionPool.batchOperationsElements')}
      className={{
        content: 'xl:w-220 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
      }}
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
            </div>
            <div className="flex flex-row items-center gap-5 self-end">
              <span
                className={twMerge(
                  'text-sm text-green-600',
                  affectedElements.length === 0 && 'text-red-600'
                )}
              >
                <FontAwesomeIcon
                  icon={affectedElements.length === 0 ? faX : faCheck}
                  className="mr-1.5"
                />
                {affectedElements.length === 0
                  ? t('manage.questionPool.noElementsWillBeUpdated')
                  : t('manage.questionPool.nElementsWillBeUpdated', {
                      number: affectedElements.length,
                    })}
              </span>
              <Button
                primary
                disabled={
                  affectedElements.length === 0 ||
                  isShallowEqual(
                    selectedActions,
                    INITIAL_ELEMENT_BATCH_OPERATIONS
                  )
                }
                onClick={async () => {
                  // TODO: implement submission logic
                  const success = false

                  // TODO: refetch elements, reset selection, show toast depending on failure / partial success / success
                }}
                className={{ root: 'h-9' }}
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
