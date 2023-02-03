import { FormikTextField } from '@uzh-bf/design-system'
import { ErrorMessage, useField } from 'formik'
import * as yup from 'yup'
import EditorField from './EditorField'
import { WizardStep } from './MultistepWizard'

function Step1() {
  const [fieldName, metaName, helpersName] = useField('name')
  const [fieldDescription, metaDescription, helpersDescription] =
    useField('description')

  return (
    <WizardStep
      onSubmit={() => console.log('Step1 onSubmit')}
      validationSchema={yup.object().shape({
        name: yup
          .string()
          .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
        displayName: yup
          .string()
          .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
        description: yup.string(),
      })}
    >
      <FormikTextField
        required
        name="name"
        label="Session-Name"
        tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
        className={{ root: 'mb-1' }}
        data-cy="insert-live-session-name"
        shouldValidate={() => true}
      />

      <FormikTextField
        required
        name="displayName"
        label="Anzeigenamen"
        tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
        className={{ root: 'mb-1' }}
        data-cy="insert-live-display-name"
      />

      <EditorField
        key={fieldName.value}
        label="Beschreibung"
        tooltip="// TODO CONTENT TOOLTIP"
        field={fieldDescription.value}
        fieldName="description"
        setFieldValue={(name, value, shouldValidate) => {
          helpersDescription.setValue(value, shouldValidate)
        }}
        error={metaDescription.error}
        touched={metaDescription.touched}
      />

      <div className="w-full text-right">
        <ErrorMessage
          name="description"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </WizardStep>
  )
}

export default Step1
