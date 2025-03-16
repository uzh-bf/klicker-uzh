import { useQuery } from '@apollo/client'
import {
  ElementInstance,
  ElementType,
  GetArtificialInstanceDocument,
  GetTemplatePreviewAnswerCollectionEntriesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import useArtificialElementInstance from '../../questions/manipulation/useArtificialElementInstance'
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

  // fetch answer collection entries for the selected answer collection (for preview)
  const { data: answerCollectionData } = useQuery(
    GetTemplatePreviewAnswerCollectionEntriesDocument,
    {
      variables: {
        templateId,
        answerCollectionId:
          templateElement.formValues &&
          'options' in templateElement.formValues &&
          'answerCollection' in templateElement.formValues.options &&
          typeof templateElement.formValues.options.answerCollection ===
            'string'
            ? parseInt(templateElement.formValues?.options.answerCollection)
            : -1,
      },
      skip:
        !templateElement.formValues ||
        !(
          templateElement.instance.elementData.__typename ===
            'SelectionElementData' ||
          templateElement.instance.elementData.__typename ===
            'CaseStudyElementData'
        ),
      fetchPolicy: 'cache-and-network',
    }
  )

  // convert current form entries into an artificial instance (skipped internally if formValues is null)
  const convertedInstance = useArtificialElementInstance({
    values: templateElement.formValues,
    elementDataTypename: templateElement.instance.elementData.__typename,
    answerCollectionEntries:
      answerCollectionData?.getTemplatePreviewAnswerCollectionEntries
        ? answerCollectionData?.getTemplatePreviewAnswerCollectionEntries
        : [],
  })

  // initialize student response with default state (SC question = default form state) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.Sc,
      response: undefined,
      valid: false,
    })

  const { data: artificialInstance, loading: artificialInstanceLoading } =
    useQuery(GetArtificialInstanceDocument, {
      variables: {
        elementId: templateElement.elementId!,
      },
      skip:
        !templateElement.useExistingElement ||
        templateElement.elementId === null,
      fetchPolicy: 'cache-and-network',
    })

  // when an existing element is selected, fetch the element and convert it into an artificial instance
  useEffect(() => {
    if (
      templateElement.useExistingElement &&
      templateElement.elementId !== null
    ) {
      if (
        artificialInstanceLoading ||
        !artificialInstance?.artificialInstance
      ) {
        return
      }

      setLoadedInstance(artificialInstance?.artificialInstance)
    }
  }, [
    templateElement.useExistingElement,
    templateElement.elementId,
    artificialInstance,
    artificialInstanceLoading,
  ])

  // when a new element is defined in the form, an artificial instance is created
  useEffect(() => {
    if (templateElement.useNewElement && templateElement.formValues) {
      if (!convertedInstance) {
        return
      }

      setLoadedInstance(convertedInstance)
    }
  }, [
    convertedInstance,
    templateElement.useNewElement,
    templateElement.formValues,
  ])

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
