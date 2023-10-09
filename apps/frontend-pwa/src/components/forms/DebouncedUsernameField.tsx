import { useLazyQuery } from '@apollo/client'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { CheckUsernameAvailabilityDocument } from '@klicker-uzh/graphql/dist/ops'
import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useCallback, useEffect, useRef, useState } from 'react'

interface DebouncedUsernameFieldProps {
  name: string
  label: string
}

function DebouncedUsernameField({ name, label }: DebouncedUsernameFieldProps) {
  const [field, _, helpers] = useField(name)
  const [valid, setValid] = useState<boolean | undefined>(undefined)

  const [checkUsernameAvailable] = useLazyQuery(
    CheckUsernameAvailabilityDocument
  )

  // check if initial username is valid
  useEffect(() => {
    const check = async () => {
      const value = await checkUsernameAvailable({
        variables: { username: field.value },
      })
      setValid(value.data?.checkUsernameAvailability)
    }
    check()
  }, [])

  const usernameValidationTimeout = useRef<any>()
  const debouncedUsernameCheck = useCallback(
    ({ username }: { username: string }) => {
      clearTimeout(usernameValidationTimeout.current)
      setValid(undefined)
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
      // TODO: set valid attribute according to current value - undefined for loading while validating, true for available, false for not available and show a corresponding icon here
      icon={faCheck}
    />
  )
}

export default DebouncedUsernameField
