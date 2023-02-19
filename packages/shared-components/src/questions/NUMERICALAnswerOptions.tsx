import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ThemeContext } from '@uzh-bf/design-system'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import NumberField from './NumberField'

export interface NUMERICALAnswerOptionsProps {
  disabled?: boolean
  accuracy?: number
  placeholder?: string
  unit?: string
  valid: boolean
  value: string | number
  min: number
  max: number
  onChange: (value: any) => any
}

export function NUMERICALAnswerOptions({
  disabled,
  accuracy,
  placeholder,
  unit,
  valid,
  value,
  min,
  max,
  onChange,
}: NUMERICALAnswerOptionsProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  // TODO: integrate accuracy prop into numberfield implementation
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row">
        {typeof min === 'number' && (
          <div className="mr-6" data-cy="input-numerical-minimum">
            Min: {min}
          </div>
        )}
        {typeof max === 'number' && (
          <div data-cy="input-numerical-maximum">Max: {max}</div>
        )}
      </div>
      <div className="flex flex-row">
        <NumberField
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          allowDecimals
          className={{
            input: twMerge(
              theme.primaryBorderFocus,
              unit && '!rounded-r-none',
              !valid && 'border-red-600'
            ),
          }}
        />
        {unit && (
          <div className="flex flex-col items-center justify-center px-4 text-white rounded-r bg-slate-600">
            {unit}
          </div>
        )}
      </div>
      {!valid && (
        <div className="text-black">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mr-1.5 ml-0.5 text-red-700"
          />
          Der eingegebene Wert ist keine Zahl oder liegt nicht im vorgegebenen
          Bereich.
        </div>
      )}
    </div>
  )
}

export default NUMERICALAnswerOptions
