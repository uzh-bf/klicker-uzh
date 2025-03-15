import { useQuery } from '@apollo/client'
import {
  faCopy,
  faEye,
  faHandPointer,
} from '@fortawesome/free-regular-svg-icons'
import { faArrowsRotate, faPen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CheckTemplateElementExistsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypes } from '~/components/questions/manipulation/types'
import ExistingElementSelectionModal from './ExistingElementSelectionModal'
import TemplateElementPreview from './TemplateElementPreview'
import { ActivityTemplateElementFormValues } from './types'

function TemplateElementContent({
  templateId,
  templateElement,
  acceptTemplateElement,
  replaceWithExistingElement,
  saveNewElement,
  onNextElement,
}: {
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  acceptTemplateElement: () => void
  replaceWithExistingElement: (elementId: number) => void
  saveNewElement: (formValues: ElementFormTypes) => void
  onNextElement: () => void
}) {
  const t = useTranslations()
  const [previewExistingInstance, setPreviewExistingInstance] = useState(false)
  const [existingElementModal, setExistingElementModal] = useState(false)
  const [newElementModal, setNewElementModal] = useState(false)

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
            <div className="mb-2 text-gray-700">
              {t('manage.template.elementActionsTemplate')}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                primary={
                  templateElement.processed &&
                  templateElement.useTemplateInstance
                }
                onClick={acceptTemplateElement}
                className={{
                  root: twMerge(
                    previewExistingInstance && 'border-primary-100 border'
                  ),
                }}
              >
                <Button.Icon icon={faCopy} />
                <Button.Label>
                  {t('manage.template.acceptTemplateElement')}
                </Button.Label>
              </Button>
              <Button
                primary={
                  templateElement.processed &&
                  templateElement.useExistingElement
                }
                onClick={() => setExistingElementModal(true)}
              >
                <Button.Icon icon={faArrowsRotate} />
                <Button.Label>
                  {t('manage.template.replaceWithExistingElement')}
                </Button.Label>
              </Button>
              <Button
                primary={
                  templateElement.processed && templateElement.useNewElement
                }
                // TODO: on click open an element editing modal (initialized with the form values or the template data if no form values are defined)
              >
                <Button.Icon icon={faPen} />
                <Button.Label>
                  {t('manage.template.insertContentNewElement')}
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
                  data-cy="preview-template-element-button"
                >
                  <Button.Icon icon={faEye} />
                  <Button.Label>
                    {t('manage.template.previewTemplateElement')}
                  </Button.Label>
                </Button>
              </div>
            ) : (
              <TemplateElementPreview
                templateElement={templateElement}
                showTemplateInstancePreview={previewExistingInstance}
              />
            )}
          </div>
        </div>
        <Button
          disabled={!templateElement.processed}
          onClick={onNextElement}
          className={{ root: 'mt-2 self-end' }}
        >
          {t('manage.template.nextElement')}
        </Button>
      </div>

      <ExistingElementSelectionModal
        open={existingElementModal}
        onClose={() => setExistingElementModal(false)}
        replaceWithExistingElement={replaceWithExistingElement}
        requiredElementType={templateElement.instance.elementType}
        hasSampleSolution={
          'options' in templateElement.instance.elementData
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
    </>
  )
}

export default TemplateElementContent
