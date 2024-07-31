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
      <textarea
        disabled={disabled}
        className="focus:border-primary-80 rounded focus:border focus:border-solid"
        id="responseInput"
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={
          typeof maxLength === 'number' && !isNaN(maxLength) ? maxLength : 1500
        }
        placeholder={placeholder || t('shared.questions.ftPlaceholder')}
        data-cy={`free-text-input-${elementIx + 1}`}
      />

      {typeof maxLength === 'number' && !isNaN(maxLength) && (
        <div className="text-right text-sm italic">
          ({value?.length ?? 0} / {maxLength ?? '1500'}{' '}
          {t('shared.generic.characters')})
        </div>
      )}
    </div>
  )
}

export default FREETextAnswerOptions
