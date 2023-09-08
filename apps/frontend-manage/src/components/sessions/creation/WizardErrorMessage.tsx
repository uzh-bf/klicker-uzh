import { Field, getIn } from 'formik'

function WizardErrorMessage({ fieldName }: { fieldName: string }) {
  return (
    <Field
      name={fieldName}
      render={({ form }: any) => {
        const error = getIn(form.errors, fieldName)
        const touch = getIn(form.touched, fieldName)

        console.log(error)

        if (typeof error === 'object' && error !== null) {
          return Object.entries(error)
            .flatMap(([ix, error]) => {
              return Object.values(error).flatMap((err) => {
                return [[+ix, err]]
              })
            })
            .flatMap(([ix, value]) => {
              return <li key={ix}>{`${ix + 1}: ${value}`}</li>
            })
        }

        return touch && error ? error : null
      }}
    />
  )
}

export default WizardErrorMessage
