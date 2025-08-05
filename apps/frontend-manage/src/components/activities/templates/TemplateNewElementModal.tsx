import ElementEditForm from '../../elements/manipulation/ElementEditForm'
import { ElementEditMode } from '../../elements/manipulation/ElementEditModal'
import { ElementFormTypes } from '../../elements/manipulation/types'
import { ActivityTemplateElementFormValues } from './types'
import useFormValuesFromElementInstance from './useFormValuesFromElementInstance'

function TemplateNewElementModal({
  onClose,
  templateId,
  templateElement,
  onSaveNewElement,
}: {
  onClose: () => void
  templateId: string
  templateElement: ActivityTemplateElementFormValues
  onSaveNewElement: (formValues: ElementFormTypes) => void
}) {
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
      onClose={onClose}
      onSuccess={onClose} // success toast is not required -> success immediately visible
      mode={ElementEditMode.CREATE}
      loading={false}
      initialValues={formValues}
      onSubmitElement={async (values) => {
        onSaveNewElement(values)
        return true
      }}
      setAutoSavedElement={() => {}} // auto-save is disabled for templates for the moment
      updateInstances={false}
      setUpdateInstances={() => {}} // instance updates are only available for existing elements
      includeTemplateUpdates={false}
      setIncludeTemplateUpdates={() => {}} // template updates are only available for existing elements
    />
  )
}

export default TemplateNewElementModal
