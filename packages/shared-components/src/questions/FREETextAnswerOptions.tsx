import React from 'react'

export interface FREETextAnswerOptionsProps {
  maxLength: number
  onChange: (value: any) => any
}

export function FREETextAnswerOptions({
  maxLength,
  onChange,
}: FREETextAnswerOptionsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="rounded focus:border focus:border-solid focus:border-uzh-blue-80"
        defaultValue=""
        id="responseInput"
        onChange={(e): void => onChange(e.target.value)}
        rows={3}
        maxLength={maxLength}
      />
      <div className="text-sm italic text-right">
        (maximal {maxLength} Zeichen)
      </div>
    </div>
  )
}

export default FREETextAnswerOptions
