import { useTranslations } from 'next-intl'
import React from 'react'

export interface FREETextAnswerOptionsProps {
  placeholder?: string
  maxLength?: number
  onChange: (value: any) => any
  value?: string
}

export function FREETextAnswerOptions({
  placeholder,
  maxLength,
  onChange,
  value,
}: FREETextAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="rounded focus:border focus:border-solid focus:border-primary-80"
        defaultValue=""
        id="responseInput"
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={maxLength ?? 1500}
        placeholder={placeholder || t('shared.questions.ftPlaceholder')}
        data-cy="free-text-response-input"
      />

      <div className="text-sm italic text-right">
        ({value?.length ?? 0} / {maxLength ?? '1500'}{' '}
        {t('shared.generic.characters')})
      </div>
    </div>
  )
}

export default FREETextAnswerOptions
