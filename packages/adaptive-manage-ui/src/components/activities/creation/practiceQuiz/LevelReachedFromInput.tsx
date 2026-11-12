import { MAX_ADAPTIVE_LEVEL_REACHED_FROM } from '@klicker-uzh/adaptive-contract'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const MAX_PERCENT = Math.round(MAX_ADAPTIVE_LEVEL_REACHED_FROM * 100)

/** Whole percent 0–95 as typed, or null when it is not one. */
export function parseLevelReachedFromPercent(text: string) {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const percent = Number(trimmed)
  return percent <= MAX_PERCENT ? percent : null
}

// "Level reached from" as a whole percent of the level (0 = nearest level).
// The value stays the stored share (0–0.95, as a string); while the field
// holds something invalid, onChange gets null and an error shows.
function LevelReachedFromInput({
  id,
  value,
  onChange,
  className,
  cy,
}: {
  id: string
  value: string
  onChange: (share: string | null) => void
  className?: string
  cy?: string
}) {
  const t = useTranslations('manage.evaluation.adaptive.levelReachedFrom')
  const [text, setText] = useState(String(Math.round(Number(value) * 100)))
  // A value set from outside (form reset, other preset) replaces the text;
  // the 'invalid' placeholder of a bad entry does not.
  const [shownValue, setShownValue] = useState(value)
  if (value !== shownValue) {
    setShownValue(value)
    const share = Number(value)
    if (
      Number.isFinite(share) &&
      parseLevelReachedFromPercent(text) !== Math.round(share * 100)
    )
      setText(String(Math.round(share * 100)))
  }
  const percent = parseLevelReachedFromPercent(text)
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_PERCENT}
          step={5}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            const next = parseLevelReachedFromPercent(event.target.value)
            onChange(next === null ? null : String(next / 100))
          }}
          aria-invalid={percent === null}
          className={twMerge(
            'h-9 w-24 rounded border border-gray-300 px-2 text-sm',
            percent === null && 'border-red-500',
            className
          )}
          data-cy={cy}
        />
        <span className="text-sm text-gray-700">
          {percent === 0 ? t('nearest') : t('ofTheLevel')}
        </span>
      </div>
      {percent === null ? (
        <p className="mt-1 text-xs text-red-600">
          {t('invalid', { max: MAX_PERCENT })}
        </p>
      ) : null}
    </div>
  )
}

export default LevelReachedFromInput
