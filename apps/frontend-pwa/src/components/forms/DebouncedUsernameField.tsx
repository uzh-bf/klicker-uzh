import { useLazyQuery } from '@apollo/client'
import { faCheck, faSpinner, faX } from '@fortawesome/free-solid-svg-icons'
import { CheckUsernameAvailabilityDocument } from '@klicker-uzh/graphql/dist/ops'
import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'

interface DebouncedUsernameFieldProps {
  name: string
  label: string
  valid: boolean | undefined
  setValid: (isAvailable: boolean | undefined) => void
}

function DebouncedUsernameField({
  name,
  label,
  valid,
  setValid,
}: DebouncedUsernameFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField(name)
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
        const { data: result } = await checkUsernameAvailable({
          variables: { username },
        })
        const isAvailable = result?.checkUsernameAvailability
        setValid(isAvailable)
        if (!isAvailable) {
          helpers.setError(t('pwa.createAccount.usernameAvailability'))
        }
      }, 1000)
    },
    []
  )

  return (
    <FormikTextField
      value={field.value}
      label={label}
      error={meta.error}
      labelType="small"
      className={{
        label: 'font-bold text-md text-black',
        icon:
          typeof valid === 'undefined'
            ? 'animate-spin !py-0'
            : valid
            ? 'text-green-600'
            : 'text-red-600 bg-red-50',
        input: valid === false ? 'border-red-600 bg-red-50' : '',
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
