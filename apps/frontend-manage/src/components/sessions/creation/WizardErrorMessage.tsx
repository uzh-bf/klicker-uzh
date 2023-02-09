import { Field, getIn } from 'formik'

function WizardErrorMessage({ fieldName }: { fieldName: string }) {
  return (
    <Field
      name={fieldName}
      render={({ form }: any) => {
        const error = getIn(form.errors, fieldName)
        const touch = getIn(form.touched, fieldName)
        return touch && error ? error : null
      }}
    />
  )
}

export default WizardErrorMessage
