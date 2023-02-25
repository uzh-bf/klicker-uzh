import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { NumberField, ThemeContext } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-6">
        {typeof min === 'number' && (
          <div data-cy="input-numerical-minimum">
            {t('shared.generic.min')}: {min}
          </div>
        )}
        {typeof max === 'number' && (
          <div data-cy="input-numerical-maximum">
            {t('shared.generic.max')}: {max}
          </div>
        )}
        {typeof accuracy === 'number' && (
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
          accuracy={accuracy}
          className={{
            input: twMerge(
              theme.primaryBorderFocus,
              unit && '!rounded-r-none',
              !valid && value !== '' && 'border-red-600'
            ),
          }}
        />
        {unit && (
          <div className="flex flex-col items-center justify-center px-4 text-white rounded-r bg-slate-600">
            {unit}
          </div>
        )}
      </div>
      {!valid && value !== '' && (
        <div className="text-black">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mr-1.5 ml-0.5 text-red-700"
          />
          {t('shared.questions.numInvalidValue')}
        </div>
      )}
    </div>
  )
}

export default NUMERICALAnswerOptions
