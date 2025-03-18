import { useQuery } from '@apollo/client'
import {
  ElementType,
  GetMatchingUserElementsTemplateDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

function ExistingElementSelectionModal({
  open,
  onClose,
  replaceWithExistingElement,
  requiredElementType,
  hasSampleSolution,
  hasAnswerFeedbacks,
}: {
  open: boolean
  onClose: () => void
  replaceWithExistingElement: (elementId: number) => void
  requiredElementType: ElementType
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
}) {
  const t = useTranslations()
  const [selectedElementId, setSelectedElementId] = useState<number | null>(
    null
  )

  const { data, loading } = useQuery(GetMatchingUserElementsTemplateDocument, {
    variables: {
      elementType: requiredElementType,
      hasSampleSolution,
      hasAnswerFeedbacks,
    },
    skip: !open,
    fetchPolicy: 'cache-and-network',
  })
  const availableElements = data?.getMatchingUserElementsTemplate ?? []

  const elementDescriptors = [
    ...(hasSampleSolution !== null && typeof hasSampleSolution !== 'undefined'
      ? hasSampleSolution
        ? [t('manage.template.withSampleSolution')]
        : [t('manage.template.withoutSampleSolution')]
      : []),
    ...(hasAnswerFeedbacks !== null && typeof hasAnswerFeedbacks !== 'undefined'
      ? hasAnswerFeedbacks
        ? [t('manage.template.withAnswerFeedbacks')]
        : [t('manage.template.withoutAnswerFeedbacks')]
      : []),
  ]
  const elementDescription =
    t(`shared.types.${requiredElementType}`) +
    (elementDescriptors.length > 0 ? ` (${elementDescriptors.join(', ')})` : '')

  return (
    <Modal
      escapeDisabled
      hideCloseButton
      title={t('manage.template.selectExistingElement')}
      open={open}
      onClose={() => {
        setSelectedElementId(null)
        onClose()
      }}
      data-cy="select-existing-question-modal"
      className={{ content: 'overflow-visible' }}
    >
      <div className="text-gray-700">
        {t('manage.template.selectElementInstructions', {
          element: elementDescription,
        })}
      </div>

      <div className="mt-2 max-h-[calc(80vh-12rem)] overflow-y-auto rounded-md border border-gray-200 p-3">
        <div className="flex flex-col gap-2">
          {loading && <Loader />}
          {availableElements.length === 0 && !loading && (
            <UserNotification
              type="warning"
              message={t('manage.template.noMatchingQuestionsFound')}
            />
          )}

          {availableElements.length > 0 &&
            availableElements.map((element) => (
              <Button
                active={selectedElementId === element.id}
                key={`element-selection-${element.id}`}
                className={{ root: 'flex-col items-start p-2' }}
                onClick={() => setSelectedElementId(element.id)}
                data={{ cy: `select-existing-element-${element.name}` }}
              >
                <div>{element.name}</div>
                <Ellipsis
                  className={{ markdown: twMerge('text-sm text-gray-600') }}
                  maxLines={2}
                >
                  {element.content}
                </Ellipsis>
              </Button>
            ))}
        </div>
      </div>

      <div className="mt-4 flex flex-row justify-between">
        <Button
          onClick={() => {
            setSelectedElementId(null)
            onClose()
          }}
          data={{ cy: 'cancel-select-existing-element' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          primary
          disabled={selectedElementId === null}
          onClick={() => {
            if (selectedElementId === null) return

            replaceWithExistingElement(selectedElementId!)
            setSelectedElementId(null)
            onClose()
          }}
          data={{ cy: 'confirm-select-existing-element' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default ExistingElementSelectionModal
