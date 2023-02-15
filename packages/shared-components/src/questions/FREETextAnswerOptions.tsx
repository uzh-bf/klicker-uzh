import { ThemeContext } from '@uzh-bf/design-system'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const theme = useContext(ThemeContext)

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={twMerge(
          'rounded focus:border focus:border-solid',
          theme.primaryBorderDarkFocus
        )}
        defaultValue=""
        id="responseInput"
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={maxLength ?? 1500}
        placeholder={placeholder || 'Bitte geben Sie hier Ihre Antwort ein'}
        data-cy="free-text-response-input"
      />

      <div className="text-sm italic text-right">
        ({value?.length ?? 0} / {maxLength ?? '1500'} Zeichen)
      </div>
    </div>
  )
}

export default FREETextAnswerOptions
