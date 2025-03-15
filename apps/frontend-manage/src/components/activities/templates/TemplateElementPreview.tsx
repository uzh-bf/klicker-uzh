import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { ActivityTemplateElementFormValues } from './types'

function TemplateElementPreview({
  templateId,
  templateElement,
  showTemplateInstancePreview = false,
}: {
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  showTemplateInstancePreview?: boolean
}): React.ReactElement {
  const t = useTranslations()
  const [loadedInstance, setLoadedInstance] = useState<ElementInstance | null>(
    null
  )

  // initialize student response with default state (SC question = default form state) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.Sc,
      response: undefined,
      valid: false,
    })

  // when an existing element is selected, fetch the element and convert it into an artificial instance
  useEffect(() => {
    if (
      templateElement.useExistingElement &&
      templateElement.elementId !== null
    ) {
      // TODO: Implement API call to fetch element instance
      // fetchElementInstance(elementId, templateId).then(data => {
      //   setLoadedInstance(data)
      // })
    }
  }, [
    templateElement.useExistingElement,
    templateElement.elementId,
    templateId,
  ])

  // when a new element is defined in the form, an artificial instance is created
  useEffect(() => {
    if (templateElement.useNewElement && templateElement.formValues) {
      // TODO: Convert formValues to instance format
      // const convertedInstance = convertFormValuesToInstance(formValues)
      // setLoadedInstance(convertedInstance)
    }
  }, [templateElement.useNewElement, templateElement.formValues])

  // set the effective instance based on mode
  const effectiveInstance =
    templateElement.useTemplateInstance || showTemplateInstancePreview
      ? templateElement.instance
      : loadedInstance

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: effectiveInstance,
    setStudentResponse,
  })

  if (!effectiveInstance) {
    return <Loader />
  }

  return (
    <div data-cy="student-element-preview">
      <H3>{t('shared.generic.preview')}</H3>
      <div className="rounded border p-4">
        <StudentElement
          preview
          element={effectiveInstance}
          elementIx={0}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
        />
      </div>
    </div>
  )
}

export default TemplateElementPreview
