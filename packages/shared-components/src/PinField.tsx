import { Label, ThemeContext } from '@uzh-bf/design-system'
import { ErrorMessage, Field, useField } from 'formik'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface PinFieldProps {
  id?: string
  name: string
  required?: boolean
  label?: string
  labelType?: 'small' | 'normal'
  tooltip?: string
  className?: {
    root?: string
    field?: string
    label?: string
    error?: string
  }
  data?: {
    cy?: string
    test?: string
  }
}

function PinField({
  id,
  name,
  required = false,
  label,
  labelType = 'normal',
  tooltip,
  className,
  data,
}: PinFieldProps) {
  const theme = useContext(ThemeContext)
  const [field, meta, helpers] = useField(name)

  return (
    <div className={className?.root}>
      {label && (
        <Label
          forId={id}
          required={required}
          label={label}
          className={{
            root: twMerge(
              'my-auto mr-2 font-bold min-w-max',
              labelType === 'small' &&
                'text-sm leading-6 text-gray-600 font-normal mt-1',
              className?.label
            ),
            tooltip: 'text-sm font-normal',
            tooltipSymbol: twMerge(labelType === 'small' && 'w-2 h-2'),
          }}
          tooltip={tooltip}
          showTooltipSymbol={typeof tooltip !== 'undefined'}
        />
      )}
      <Field
        name={name}
        type="text"
        data-cy={data?.cy}
        data-test={data?.test}
        placeholder="### ### ###"
        className={twMerge(
          'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
          theme.primaryBorderFocus,
          meta.error && meta.touched && 'border-red-400 bg-red-50 mb-0',
          className?.field
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
            helpers.setValue(
              `${paste.slice(0, 3)} ${paste.slice(3, 6)} ${paste.slice(6, 9)}`
            )
          } else if (
            typeof paste === 'string' &&
            paste.length === 11 &&
            paste.match(/^[0-9]{3}\ [0-9]{3}\ [0-9]{3}$/g)
          ) {
            helpers.setValue(paste)
          }
        }}
        onChange={(e: any) => {
          // regex magic to only allow numerical pins in the format ### ### ###
          const regexToMatch =
            /([0-9]{3}\ [0-9]{3}\ [0-9]{0,3})|([0-9]{3}\ [0-9]{3}[\ ]{0,1})|([0-9]{3}\ [0-9]{0,3})|([0-9]{3}[\ ]{0,1})|([0-9]{0,3})/g
          const valueMatched = e.target.value.match(regexToMatch)[0]

          // only add a whitespace after a block of 3 numbers if the user is typing - otherwise deletions are not possible
          if (
            (valueMatched.match(/^[0-9]{3}$/g) &&
              field.value.match(/^[0-9]{2}$/g)) ||
            (valueMatched.match(/^[0-9]{3}\ [0-9]{3}$/g) &&
              field.value.match(/^[0-9]{3}\ [0-9]{2}$/g))
          ) {
            helpers.setValue(valueMatched + ' ')
          } else {
            helpers.setValue(valueMatched)
          }
        }}
      />
      <ErrorMessage
        name={name}
        component="div"
        className={twMerge('text-sm text-red-400', className?.error)}
      />
    </div>
  )
}

export default PinField
