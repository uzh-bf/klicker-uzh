import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface NUMERICALAnswerOptionsOLDProps {
  disabled?: boolean
  accuracy?: number
  placeholder?: string
  unit?: string
  valid: boolean
  value: string | number
  min?: number
  max?: number
  onChange: (value: any) => any
  hidePrecision?: boolean
}

export function NUMERICALAnswerOptionsOLD({
  disabled,
  accuracy,
  placeholder,
  unit,
  valid,
  value,
  min,
  max,
  onChange,
  hidePrecision,
}: NUMERICALAnswerOptionsOLDProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-6">
        {typeof min === 'number' && !isNaN(min) && (
          <div data-cy="input-numerical-minimum">
            {t('shared.generic.min')}: {min}
          </div>
        )}
        {typeof max === 'number' && !isNaN(max) && (
          <div data-cy="input-numerical-maximum">
            {t('shared.generic.max')}: {max}
          </div>
        )}
        {!hidePrecision && typeof accuracy === 'number' && !isNaN(accuracy) && (
          <div data-cy="input-numerical-accuracy">
            {t('shared.generic.precision')}: {accuracy}
          </div>
        )}
      </div>
      <div className="flex flex-row">
        <NumberField
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          precision={accuracy}
          className={{
            input: twMerge(
              'focus:border-primary-80',
              unit && '!rounded-r-none',
              !valid && value !== '' && 'border-red-600'
            ),
          }}
        />
        {unit && (
          <div className="flex min-w-max flex-col items-center justify-center rounded-r bg-slate-600 px-4 text-white">
            {unit}
          </div>
        )}
      </div>
      {!valid && value !== '' && (
        <div className="text-black">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="ml-0.5 mr-1.5 text-red-700"
          />
          {t('shared.questions.numInvalidValue')}
        </div>
      )}
    </div>
  )
}

export default NUMERICALAnswerOptionsOLD
