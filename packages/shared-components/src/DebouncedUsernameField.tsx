import { faCheck, faSpinner, faX } from '@fortawesome/free-solid-svg-icons'
import type { TextFieldClassName } from '@uzh-bf/design-system'
import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface DebouncedUsernameFieldProps {
  name: string
  label?: string
  valid: boolean | undefined
  setValid: (isAvailable: boolean | undefined) => void
  validateField: () => void
  checkUsernameAvailable: (username: string) => Promise<boolean>
  unavailableMessage: string
  labelType?: 'small' | 'large'
  required?: boolean
  hideError?: boolean
  data?: {
    cy?: string
    test?: string
  }
  className?: TextFieldClassName & { root?: string }
}

function DebouncedUsernameField({
  name,
  label,
  valid,
  setValid,
  validateField,
  checkUsernameAvailable,
  unavailableMessage,
  labelType = 'small',
  required = false,
  hideError = false,
  data,
  className,
}: DebouncedUsernameFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField<string>(name)

  // validate field when valid value changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: valid intentionally triggers revalidation even though it is not read by the callback
  useEffect(() => {
    validateField()
  }, [validateField, valid])

  // check if initial username is valid
  // biome-ignore lint/correctness/useExhaustiveDependencies: the initial availability check intentionally runs once for the initial field value
  useEffect(() => {
    const check = async () => {
      const valid = await checkUsernameAvailable(field.value)
      setValid(valid)
    }
    check()
  }, [])

  const usernameValidationTimeout = useRef<any>(null)
  const debouncedUsernameCheck = useCallback(
    ({ username }: { username: string }) => {
      clearTimeout(usernameValidationTimeout.current)
      setValid(undefined)
      usernameValidationTimeout.current = setTimeout(async () => {
        const isAvailable = await checkUsernameAvailable(username)
        setValid(isAvailable)
        if (!isAvailable) {
          helpers.setError(unavailableMessage)
        }
      }, 1000)
    },
    [checkUsernameAvailable, helpers.setError, setValid, unavailableMessage]
  )

  return (
    <FormikTextField
      value={field.value}
      label={label}
      error={meta.error}
      labelType={labelType}
      className={{
        ...className,
        label: twMerge('text-md font-bold text-black', className?.label),
        icon: twMerge(
          typeof valid === 'undefined'
            ? 'py-0! animate-spin bg-transparent'
            : !valid || typeof meta.error !== 'undefined'
              ? 'bg-red-50 text-red-600'
              : 'text-green-700',
          className?.icon
        ),
        input: twMerge(
          'pl-8!',
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
