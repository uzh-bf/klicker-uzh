import { useTranslations } from 'next-intl'
import React from 'react'

export interface FREETextAnswerOptionsOLDProps {
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  onChange: (value: any) => any
  value?: string
}

export function FREETextAnswerOptionsOLD({
  disabled,
  placeholder,
  maxLength,
  onChange,
  value,
}: FREETextAnswerOptionsOLDProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <textarea
        disabled={disabled}
        className="rounded focus:border focus:border-solid focus:border-primary-80"
        id="responseInput"
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={
          typeof maxLength === 'number' && !isNaN(maxLength) ? maxLength : 1500
        }
        placeholder={placeholder || t('shared.questions.ftPlaceholder')}
        data-cy="free-text-response-input"
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

export default FREETextAnswerOptionsOLD
