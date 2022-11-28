import React from 'react'

export interface FREETextAnswerOptionsProps {
  placeholder?: string
  maxLength?: number
  onChange: (value: any) => any
  value: string
}

export function FREETextAnswerOptions({
  placeholder,
  maxLength,
  onChange,
  value,
}: FREETextAnswerOptionsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="rounded focus:border focus:border-solid focus:border-uzh-blue-80"
        defaultValue=""
        id="responseInput"
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={maxLength ?? 1500}
        placeholder={placeholder || 'Bitte geben Sie hier Ihre Antwort ein'}
      />

      <div className="text-sm italic text-right">
        ({value.length} / {maxLength ?? '1500'} Zeichen)
      </div>
    </div>
  )
}

export default FREETextAnswerOptions
