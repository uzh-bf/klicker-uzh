import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface NUMERICALAnswerOptionsProps {
  valid: boolean
  value: any
  min: number
  max: number
  onChange: (value: any) => any
}

export function NUMERICALAnswerOptions({
  valid,
  value,
  min,
  max,
  onChange,
}: NUMERICALAnswerOptionsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row">
        {typeof min === 'number' && <div className="mr-6">Min: {min}</div>}
        {typeof max === 'number' && <div>Max: {max}</div>}
      </div>
      <input
        type="text"
        value={value}
        className={twMerge(
          'rounded focus:border focus:border-solid focus:border-uzh-blue-80',
          !valid && 'border-red-600'
        )}
        onChange={(e): void =>
          onChange(e.target.value.replace(/[^0-9.-]/g, ''))
        }
      />
      {!valid && (
        <div className="text-black">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mr-1.5 ml-0.5 text-red-700"
          />
          Der eingegebene Wert ist keine Zahl oder liegt nicht im vorgegebenen
          Bereich
        </div>
      )}
    </div>
  )
}

export default NUMERICALAnswerOptions
