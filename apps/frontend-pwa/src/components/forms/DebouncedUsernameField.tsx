import { useLazyQuery } from '@apollo/client'
import { CheckUsernameAvailabilityDocument } from '@klicker-uzh/graphql/dist/ops'
import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'

interface DebouncedUsernameFieldProps {
  name: string
  label: string
}

function DebouncedUsernameField({ name, label }: DebouncedUsernameFieldProps) {
  const [field, _, helpers] = useField(name)

  const [checkUsernameAvailable] = useLazyQuery(
    CheckUsernameAvailabilityDocument
  )

  return (
    <FormikTextField
      value={field.value}
      label={label}
      labelType="small"
      className={{
        label: 'font-bold text-md text-black',
      }}
      onChange={async (username: string) => {
        const value = await checkUsernameAvailable({ variables: { username } })
        console.log('value', value.data?.checkUsernameAvailability)
        helpers.setValue(username)
      }}
    />
  )
}

export default DebouncedUsernameField
