import { faCheck, faSpinner, faX } from '@fortawesome/free-solid-svg-icons'
import { FormikTextField, TextFieldWithNameProps } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface DebouncedUsernameFieldProps {
  name: string
  label: string
  valid: boolean | undefined
  setValid: (isAvailable: boolean | undefined) => void
  validateField: () => void
  checkUsernameAvailable: (username: string) => Promise<boolean>
  labelType?: TextFieldWithNameProps['labelType']
  required?: boolean
  hideError?: boolean
  data?: {
    cy?: string
    test?: string
  }
  className?: TextFieldWithNameProps['className']
}

function DebouncedUsernameField({
  name,
  label,
  valid,
  setValid,
  validateField,
  checkUsernameAvailable,
  labelType = 'small',
  required = false,
  hideError = false,
  data,
  className,
}: DebouncedUsernameFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField(name)

  // validate field when valid value changes
  useEffect(() => {
    validateField()
  }, [valid])

  // check if initial username is valid
  useEffect(() => {
    const check = async () => {
      const valid = await checkUsernameAvailable(field.value)
      setValid(valid)
    }
    check()
  }, [])

  const usernameValidationTimeout = useRef<any>()
  const debouncedUsernameCheck = useCallback(
    ({ username }: { username: string }) => {
      clearTimeout(usernameValidationTimeout.current)
      setValid(undefined)
      usernameValidationTimeout.current = setTimeout(async () => {
        const isAvailable = await checkUsernameAvailable(username)
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
      labelType={labelType}
      className={{
        ...className,
        label: twMerge('font-bold text-md text-black', className?.label),
        icon: twMerge(
          typeof valid === 'undefined'
            ? 'animate-spin !py-0 bg-transparent'
            : !valid || typeof meta.error !== 'undefined'
            ? 'text-red-600 bg-red-50'
            : 'text-green-600',
          className?.icon
        ),
        input: twMerge(
          valid === false || typeof meta.error !== 'undefined'
            ? 'border-red-600 bg-red-50'
            : '',
          className?.input
        ),
      }}
      onChange={async (username: string) => {
        const trimmedUsername = username.trim()
        await helpers.setValue(trimmedUsername)
        debouncedUsernameCheck({ username: trimmedUsername })
      }}
      icon={
        typeof valid === 'undefined'
          ? faSpinner
          : valid === false || typeof meta.error !== 'undefined'
          ? faX
          : faCheck
      }
      required={required}
      hideError={hideError}
      data={data}
    />
  )
}

export default DebouncedUsernameField
