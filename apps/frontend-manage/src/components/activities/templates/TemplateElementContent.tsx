import { useQuery } from '@apollo/client'
import {
  faCopy,
  faEye,
  faHandPointer,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArrowRight,
  faArrowsRotate,
  faPen,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CheckTemplateElementExistsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Tooltip, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypes } from '../../elements/manipulation/types'
import ExistingElementSelectionModal from './ExistingElementSelectionModal'
import NewElementDataDiscardingModal from './NewElementDataDiscardingModal'
import TemplateElementPreview from './TemplateElementPreview'
import TemplateNewElementModal from './TemplateNewElementModal'
import { ActivityTemplateElementFormValues } from './types'

function TemplateElementContent({
  blockIx,
  elementIx,
  templateId,
  templateElement,
  acceptTemplateElement,
  replaceWithExistingElement,
  saveNewElement,
  onNextElement,
}: {
  blockIx: number
  elementIx: number
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  acceptTemplateElement: () => void
  replaceWithExistingElement: (elementId: number, elementName: string) => void
  saveNewElement: (formValues: ElementFormTypes) => void
  onNextElement: () => void
}) {
  const t = useTranslations()
  const [previewExistingInstance, setPreviewExistingInstance] = useState(true)
  const [existingElementModal, setExistingElementModal] = useState(false)
  const [newElementModal, setNewElementModal] = useState(false)

  // confirmation modal to confirm the switch away from  custom content
  const [comfirmDiscardCustom, setConfirmDiscardCustom] = useState<{
    open: boolean
    onConfirm: () => void
  }>({
    open: false,
    onConfirm: () => {},
  })

  // check if the user already has access to an element with that specific name
  const { data: nameCheck } = useQuery(CheckTemplateElementExistsDocument, {
    variables: {
      name: templateElement.instance.elementData.name,
    },
    skip: templateElement.useExistingElement || templateElement.useNewElement,
  })

  // once either an existing element is selected or a new element is created, unset the preview parameter
  useEffect(() => {
    if (templateElement.processed) {
      setPreviewExistingInstance(false)
    }
  }, [templateElement.processed])

  return (
    <>
      <div className="mb-6 flex flex-col">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <div className="w-full md:w-1/2">
            <div className="mb-1 flex flex-row items-center gap-2.5">
              <H3 className={{ root: 'mb-0' }}>
                {t('manage.template.availableActions')}
              </H3>
              {!(blockIx === 0 && elementIx === 0) ? (
                <Tooltip
                  tooltip={t('manage.template.elementActionsTemplate')}
                  className={{ tooltip: 'max-w-120 text-sm' }}
                >
                  <FontAwesomeIcon
                    icon={faQuestion}
                    className={
                      'bg-primary-100 mt-1 h-2.5 w-2.5 rounded-full border border-solid border-white p-1 text-white'
                    }
                  />
                </Tooltip>
              ) : null}
            </div>
            {blockIx === 0 && elementIx === 0 ? (
              <div className="mb-2 text-gray-700">
                {t('manage.template.elementActionsTemplate')}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                active={
                  templateElement.processed &&
                  templateElement.useTemplateInstance
                }
                onClick={() => {
                  if (templateElement.formValues !== null) {
                    setConfirmDiscardCustom({
                      open: true,
                      onConfirm: () => acceptTemplateElement(),
                    })
                  } else {
                    acceptTemplateElement()
                  }
                }}
                className={{
                  root: twMerge(
                    previewExistingInstance && 'border-primary-100 border'
                  ),
                }}
                data={{ cy: `accept-template-element-${blockIx}-${elementIx}` }}
              >
                <Button.Icon icon={faCopy} />
                <Button.Label>
                  {t('manage.template.acceptTemplateElement')}
                </Button.Label>
              </Button>
              <Button
                active={
                  templateElement.processed &&
                  templateElement.useExistingElement
                }
                onClick={() => {
                  if (templateElement.formValues !== null) {
                    setConfirmDiscardCustom({
                      open: true,
                      onConfirm: () => setExistingElementModal(true),
                    })
                  } else {
                    setExistingElementModal(true)
                  }
                }}
                data={{
                  cy: `replace-with-existing-element-${blockIx}-${elementIx}`,
                }}
              >
                <Button.Icon icon={faArrowsRotate} />
                <Button.Label>
                  {t('manage.template.replaceWithExistingElement')}
                </Button.Label>
              </Button>
              <Button
                active={
                  templateElement.processed && templateElement.useNewElement
                }
                onClick={() => setNewElementModal(true)}
                data={{
                  cy: `create-new-element-template-${blockIx}-${elementIx}`,
                }}
              >
                <Button.Icon icon={faPen} />
                <Button.Label>
                  {templateElement.processed && templateElement.useNewElement
                    ? t('manage.template.editContentNewElement')
                    : t('manage.template.insertContentNewElement')}
                </Button.Label>
              </Button>
              {nameCheck?.checkTemplateElementExists &&
              (!templateElement.processed ||
                templateElement.useTemplateInstance) ? (
                <UserNotification
                  type="warning"
                  message={t('manage.template.sameNamedElementExists', {
                    elementName: templateElement.instance.elementData.name,
                  })}
                  data={{
                    cy: `same-name-element-warning-${blockIx}-${elementIx}`,
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="w-full md:w-1/2">
            {!templateElement.processed && !previewExistingInstance ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md bg-gray-100 p-6">
                <div className="flex items-center gap-2.5 text-center text-gray-600">
                  <FontAwesomeIcon icon={faHandPointer} />
                  <span>{t('manage.template.selectActionOptionElement')}</span>
                </div>
                <Button
                  onClick={() => setPreviewExistingInstance(true)}
                  className={{
                    root: 'border-primary-100 border bg-gray-100 hover:bg-white',
                  }}
                  data-cy={`preview-template-element-button-${blockIx}-${elementIx}`}
                >
                  <Button.Icon icon={faEye} />
                  <Button.Label>
                    {t('manage.template.previewTemplateElement')}
                  </Button.Label>
                </Button>
              </div>
            ) : (
              <TemplateElementPreview
                templateId={templateId}
                templateElement={templateElement}
                showTemplateInstancePreview={previewExistingInstance}
              />
            )}
          </div>
        </div>
        <Button
          primary={templateElement.processed}
          disabled={!templateElement.processed}
          onClick={onNextElement}
          className={{ root: 'mt-2 self-end' }}
          data={{ cy: `next-template-element-${blockIx}-${elementIx}` }}
        >
          <Button.Icon icon={faArrowRight} />
          <Button.Label>{t('manage.template.nextElement')}</Button.Label>
        </Button>
      </div>

      {existingElementModal && (
        <ExistingElementSelectionModal
          onClose={() => setExistingElementModal(false)}
          replaceWithExistingElement={replaceWithExistingElement}
          requiredElementType={templateElement.instance.elementType}
          hasSampleSolution={
            'options' in templateElement.instance.elementData &&
            'hasSampleSolution' in templateElement.instance.elementData.options
              ? templateElement.instance.elementData.options.hasSampleSolution
              : null
          }
          hasAnswerFeedbacks={
            'options' in templateElement.instance.elementData &&
            'hasAnswerFeedbacks' in templateElement.instance.elementData.options
              ? templateElement.instance.elementData.options.hasAnswerFeedbacks
              : null
          }
        />
      )}

      {newElementModal && (
        <TemplateNewElementModal
          templateId={templateId}
          onClose={() => setNewElementModal(false)}
          templateElement={templateElement}
          onSaveNewElement={saveNewElement}
        />
      )}

      {comfirmDiscardCustom.open && (
        <NewElementDataDiscardingModal
          onClose={() =>
            setConfirmDiscardCustom({ open: false, onConfirm: () => {} })
          }
          onConfirm={() => {
            comfirmDiscardCustom.onConfirm()
            setConfirmDiscardCustom({ open: false, onConfirm: () => {} })
          }}
        />
      )}
    </>
  )
}

export default TemplateElementContent
