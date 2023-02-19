import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface NumberFieldProps {
  id?: string
  data?: {
    cy?: string
    test?: string
  }
  value: string | number
  onChange: (newValue: string) => void
  placeholder?: string
  disabled?: boolean
  allowDecimals?: boolean
  className?: {
    input?: string
  }
  [key: string]: any
}

export function NumberField({
  id,
  data,
  value,
  onChange,
  placeholder,
  allowDecimals,
  disabled,
  className,
}: NumberFieldProps): React.ReactElement {
  return (
    <input
      id={id}
      data-cy={data?.cy}
      data-test={data?.test}
      type="text"
      value={value}
      onChange={(e) => {
        if (allowDecimals && e.target.value.match(/^[-]?\d*\.?\d*$/)) {
          onChange(e.target.value)
        } else {
          onChange(e.target.value.replace(/[-]?[^0-9]/g, ''))
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={twMerge(
        'w-full rounded bg-uzh-grey-20 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
        disabled && 'cursor-not-allowed',
        className?.input
      )}
    />
  )
}

export default NumberField
