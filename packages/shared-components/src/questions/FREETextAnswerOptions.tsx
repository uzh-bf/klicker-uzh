import { TextareaField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

export interface FREETextAnswerOptionsProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  disabled: boolean
  elementIx: number
}

export function FREETextAnswerOptions({
  placeholder,
  maxLength,
  onChange,
  value,
  disabled,
  elementIx,
}: FREETextAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <TextareaField
        id="responseInput"
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={3}
        maxLength={
          typeof maxLength === 'number' && !isNaN(maxLength) ? maxLength : 1500
        }
        maxLengthUnit={t('shared.generic.characters')}
        placeholder={placeholder || t('shared.questions.ftPlaceholder')}
        data={{ cy: `free-text-input-${elementIx + 1}` }}
        className={{
          input:
            'rounded focus:border focus:border-solid focus:border-primary-80',
        }}
      />
    </div>
  )
}

export default FREETextAnswerOptions
