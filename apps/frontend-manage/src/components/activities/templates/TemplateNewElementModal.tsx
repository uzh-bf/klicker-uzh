import { ElementStatus } from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import ElementEditForm from '../../questions/manipulation/ElementEditForm'
import { ElementEditMode } from '../../questions/manipulation/ElementEditModal'
import { ElementFormTypes } from '../../questions/manipulation/types'
import { ActivityTemplateElementFormValues } from './types'
import useFormValuesFromElementInstance from './useFormValuesFromElementInstance'

function TemplateNewElementModal({
  open,
  onClose,
  templateId,
  templateElement,
  onSaveNewElement,
}: {
  open: boolean
  onClose: () => void
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  onSaveNewElement: (formValues: ElementFormTypes) => void
}) {
  const [failureToast, setFailureToast] = useState(false)

  const instanceFormValues = useFormValuesFromElementInstance({
    instance: templateElement.instance,
  })
  const formValues =
    templateElement.formValues !== null
      ? templateElement.formValues
      : instanceFormValues

  return (
    <ElementEditForm
      isTemplate
      templateId={templateId}
      open={open}
      onClose={onClose}
      onSuccess={onClose} // success toast is not required -> success immediately visible
      mode={ElementEditMode.CREATE}
      loading={false}
      initialValues={formValues}
      initialStatus={ElementStatus.Ready}
      onSubmitElement={async (values) => {
        onSaveNewElement(values)
      }}
      setAutoSavedElement={() => {}} // auto-save is disabled for templates for the moment
      failureToast={failureToast}
      setFailureToast={setFailureToast}
      updateInstances={false}
      setUpdateInstances={() => {}} // instance updates are only available for existing elements
      includeTemplateUpdates={false}
      setIncludeTemplateUpdates={() => {}} // template updates are only available for existing elements
    />
  )
}

export default TemplateNewElementModal
