import { faEye, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypes } from '~/components/questions/manipulation/types'
import TemplateElementPreview from './TemplateElementPreview'
import { ActivityTemplateElementFormValues } from './types'

function TemplateElementContent({
  templateId,
  templateElement,
  acceptTemplateElement,
  replaceWithExistingElement,
  saveNewElement,
}: {
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  acceptTemplateElement: () => void
  replaceWithExistingElement: (elementId: number) => void
  saveNewElement: (formValues: ElementFormTypes) => void
}) {
  const t = useTranslations()
  const [previewExistingInstance, setPreviewExistingInstance] = useState(false)

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
      <div className="w-full md:w-1/2">
        <div className="mb-2 text-gray-700">
          {t('manage.template.elementActionsTemplate')}
        </div>
        <div className="flex flex-col gap-3">
          {/* // TODO: SHOW WARNING HERE IF AN ELEMENT WITH THE SAME NAME AS DEFINED IN THE FORM VALUES IS ALREADY DEFINED (and "keep existing instance" is selected) */}
          <Button
            primary={
              templateElement.processed && templateElement.useTemplateInstance
            }
            onClick={acceptTemplateElement}
            className={{
              root: twMerge(
                previewExistingInstance && 'border-primary-100 border'
              ),
            }}
          >
            <Button.Label>
              {t('manage.template.acceptTemplateElement')}
            </Button.Label>
          </Button>
          <Button
            primary={
              templateElement.processed && templateElement.useExistingElement
            }
            // TODO: on click - open modal where an existing element can be selected
          >
            <Button.Label>
              {t('manage.template.replaceWithExistingElement')}
            </Button.Label>
          </Button>
          <Button
            primary={templateElement.processed && templateElement.useNewElement}
            // TODO: on click open an element editing modal (initialized with the form values or the template data if no form values are defined)
          >
            <Button.Label>
              {t('manage.template.insertContentNewElement')}
            </Button.Label>
          </Button>
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
            templateId={templateId}
            templateElement={templateElement}
            showTemplateInstancePreview={previewExistingInstance}
          />
        )}
      </div>
    </div>
  )
}

export default TemplateElementContent
