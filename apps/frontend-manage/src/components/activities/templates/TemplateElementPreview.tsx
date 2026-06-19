import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo, useState, type ComponentProps } from 'react'
import {
  ElementType,
  type ElementInstance,
} from '../../../lib/constants/elementTypes'
import { trpc } from '../../../lib/trpc'
import useArtificialElementInstance from '../../elements/manipulation/useArtificialElementInstance'
import { ActivityTemplateElementFormValues } from './types'

type StudentElementInstance = ComponentProps<typeof StudentElement>['element']

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

  const answerCollectionId =
    templateElement.formValues &&
    'options' in templateElement.formValues &&
    'answerCollection' in templateElement.formValues.options &&
    typeof templateElement.formValues.options.answerCollection === 'string'
      ? parseInt(templateElement.formValues.options.answerCollection)
      : -1
  const shouldFetchAnswerCollectionEntries =
    !!templateElement.formValues &&
    (templateElement.instance.elementData.__typename ===
      'SelectionElementData' ||
      templateElement.instance.elementData.__typename ===
        'CaseStudyElementData')

  // fetch answer collection entries for the selected answer collection (for preview)
  const { data: answerCollectionData } =
    trpc.activity.templatePreviewAnswerCollectionEntries.useQuery(
      {
        templateId,
        answerCollectionId,
      },
      {
        enabled: shouldFetchAnswerCollectionEntries,
      }
    )

  const existingElementId =
    typeof templateElement.elementId === 'number'
      ? templateElement.elementId
      : -1
  const shouldFetchArtificialInstance =
    templateElement.useExistingElement && existingElementId !== -1

  const { data: artificialInstanceData, isLoading: artificialInstanceLoading } =
    trpc.element.artificialInstance.useQuery(
      {
        elementId: existingElementId,
      },
      {
        enabled: shouldFetchArtificialInstance,
      }
    )

  const artificialInstance = artificialInstanceData?.artificialInstance as
    | ElementInstance
    | null
    | undefined

  // to avoid re-rendering issues, memoize the collection entries before passing them to the artificial instance computation
  const stableCollectionEntries = useMemo(() => {
    if (answerCollectionData?.templatePreviewAnswerCollectionEntries) {
      return answerCollectionData.templatePreviewAnswerCollectionEntries
    }

    return undefined
  }, [answerCollectionData?.templatePreviewAnswerCollectionEntries])

  // convert current form entries into an artificial instance (skipped internally if formValues is null)
  const convertedInstance = useArtificialElementInstance({
    values: templateElement.formValues,
    elementDataTypename: templateElement.instance.elementData.__typename,
    answerCollectionEntries: stableCollectionEntries,
  })

  // initialize student response with default state (SC question = default form state) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.Sc as InstanceStackStudentResponseType['type'],
      response: undefined,
      valid: false,
    })

  // determine the loaded instance based on whether an existing element is selected or a new element is defined
  const loadedInstance = useMemo(() => {
    if (
      templateElement.useExistingElement &&
      templateElement.elementId !== null
    ) {
      if (!artificialInstanceLoading && artificialInstance) {
        return artificialInstance
      }
    } else if (
      templateElement.useNewElement &&
      templateElement.formValues &&
      convertedInstance
    ) {
      return convertedInstance
    }

    return null
  }, [
    templateElement.useExistingElement,
    templateElement.elementId,
    artificialInstance,
    artificialInstanceLoading,
    templateElement.useNewElement,
    templateElement.formValues,
    convertedInstance,
  ])

  // set the effective instance based on mode
  const effectiveInstance =
    templateElement.useTemplateInstance || showTemplateInstancePreview
      ? templateElement.instance
      : loadedInstance

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: effectiveInstance as StudentElementInstance | null,
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
          element={effectiveInstance as StudentElementInstance}
          elementIx={0}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
        />
      </div>
    </div>
  )
}

export default TemplateElementPreview
