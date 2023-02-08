import { Label, ThemeContext } from '@uzh-bf/design-system'
import { ErrorMessage, Field } from 'formik'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

function PinField({
  name,
  label,
  error,
  touched,
  value,
  setFieldValue,
}: {
  name: string
  label?: string
  error?: string
  touched?: boolean
  value: string
  setFieldValue: (field: string, value: any) => void
}) {
  const theme = useContext(ThemeContext)

  return (
    <>
      {label && <Label label={label} className={{ root: 'italic' }} />}
      <Field
        name={name}
        type="text"
        placeholder="### ### ###"
        className={twMerge(
          'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
          theme.primaryBorderFocus,
          error && touched && 'border-red-400 bg-red-50 mb-0'
        )}
        maxLength={11}
        onPaste={(e: any) => {
          e.preventDefault()
          const paste = e.clipboardData?.getData('text')
          if (
            typeof paste === 'string' &&
            paste.length === 9 &&
            paste.match(/^[0-9]{9}$/g)
          ) {
            setFieldValue(
              name,
              `${paste.slice(0, 3)} ${paste.slice(3, 6)} ${paste.slice(6, 9)}`
            )
          } else if (
            typeof paste === 'string' &&
            paste.length === 11 &&
            paste.match(/^[0-9]{3}\ [0-9]{3}\ [0-9]{3}$/g)
          ) {
            setFieldValue(name, paste)
          }
        }}
        onChange={(e: any) => {
          // regex magic to only allow numerical pins in the format ### ### ###
          const regexToMatch =
            /([0-9]{3}\ [0-9]{3}\ [0-9]{0,3})|([0-9]{3}\ [0-9]{3}[\ ]{0,1})|([0-9]{3}\ [0-9]{0,3})|([0-9]{3}[\ ]{0,1})|([0-9]{0,3})/g
          const valueMatched = e.target.value.match(regexToMatch)[0]

          // only add a whitespace after a block of 3 numbers if the user is typing - otherwise deletions are not possible
          if (
            (valueMatched.match(/^[0-9]{3}$/g) && value.match(/^[0-9]{2}$/g)) ||
            (valueMatched.match(/^[0-9]{3}\ [0-9]{3}$/g) &&
              value.match(/^[0-9]{3}\ [0-9]{2}$/g))
          ) {
            setFieldValue(name, valueMatched + ' ')
          } else {
            setFieldValue(name, valueMatched)
          }
        }}
      />
      <ErrorMessage
        name={name}
        component="div"
        className="text-sm text-red-400"
      />
    </>
  )
}

export default PinField
