import { useLazyQuery } from '@apollo/client'
import { faCheck, faSpinner, faX } from '@fortawesome/free-solid-svg-icons'
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
        setValid(value.data?.checkUsernameAvailability)
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
        icon:
          typeof valid === 'undefined'
            ? 'animate-spin !py-0'
            : valid
            ? 'text-green-600'
            : 'text-red-600',
        input: valid === false ? 'border-red-600' : '',
      }}
      onChange={async (username: string) => {
        debouncedUsernameCheck({ username })
        helpers.setValue(username)
      }}
      icon={typeof valid === 'undefined' ? faSpinner : valid ? faCheck : faX}
    />
  )
}

export default DebouncedUsernameField
