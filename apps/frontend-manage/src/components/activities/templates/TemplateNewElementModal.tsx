import { useState } from 'react'
import ElementEditForm from '../../questions/manipulation/ElementEditForm'
import { ElementEditMode } from '../../questions/manipulation/ElementEditModal'
import { ElementFormTypes } from '../../questions/manipulation/types'
import { ActivityTemplateElementFormValues } from './types'
import useFormValuesFromElementInstance from './useFormValuesFromElementInstance'

function TemplateNewElementModal({
  open,
  onClose,
  templateElement,
  onSaveNewElement,
}: {
  open: boolean
  onClose: () => void
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

  // TODO: block certain fields -> sample solution, answer feedback, status (blocked on ready), tags
  // TODO: IN TEMPLATE MODE - extend live of available answer collections with the ones used in the template
  return (
    <ElementEditForm
      isTemplate
      open={open}
      onClose={onClose}
      onSuccess={() => {}} // success toast is not required -> success immediately visible
      mode={ElementEditMode.CREATE}
      loading={false}
      initialValues={formValues}
      onSubmitElement={async (values) => {
        onSaveNewElement(values)
      }}
      setAutoSavedElement={() => {}} // auto-save is disabled for templates for the moment
      failureToast={failureToast}
      setFailureToast={setFailureToast}
      updateInstances={false}
      setUpdateInstances={() => {}} // instance updates are only available for existing elements
    />
  )
}

export default TemplateNewElementModal
