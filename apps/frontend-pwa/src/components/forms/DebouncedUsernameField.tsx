import { useLazyQuery } from '@apollo/client'
import { CheckUsernameAvailabilityDocument } from '@klicker-uzh/graphql/dist/ops'
import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useCallback, useRef } from 'react'

interface DebouncedUsernameFieldProps {
  name: string
  label: string
}

function DebouncedUsernameField({ name, label }: DebouncedUsernameFieldProps) {
  const [field, _, helpers] = useField(name)

  const [checkUsernameAvailable] = useLazyQuery(
    CheckUsernameAvailabilityDocument
  )

  const usernameValidationTimeout = useRef<any>()
  const debouncedUsernameCheck = useCallback(
    ({ username }: { username: string }) => {
      clearTimeout(usernameValidationTimeout.current)
      usernameValidationTimeout.current = setTimeout(async () => {
        const value = await checkUsernameAvailable({ variables: { username } })
        console.log('value', value.data?.checkUsernameAvailability)
      }, 1000)
    },
    [checkUsernameAvailable]
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
        debouncedUsernameCheck({ username })
        helpers.setValue(username)
      }}
    />
  )
}

export default DebouncedUsernameField
