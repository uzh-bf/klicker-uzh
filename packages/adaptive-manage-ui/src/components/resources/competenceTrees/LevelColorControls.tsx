import { faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import {
  ADAPTIVE_LEVEL_MARKER_COLOR,
  contrastRatio,
  normalizeAdaptiveLevelColor,
} from '@klicker-uzh/adaptive-contract'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import IconAction from './IconAction'
import type { LevelColorRow } from './levelColors'

export function LevelColorField({
  row,
  index,
  onChange,
  disabled,
}: {
  row: LevelColorRow
  index: number
  onChange: (color: string | null) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const [draft, setDraft] = useState(row.override ?? '')
  useEffect(() => setDraft(row.override ?? ''), [row.override])
  const invalid = !normalizeAdaptiveLevelColor(draft).valid
  const hexId = `competence-tree-level-color-hex-${index}`
  const messageId = `competence-tree-level-color-message-${index}`

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={row.color}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label={t('manage.competenceTree.levelColorPicker', {
            label: row.label,
          })}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          data-cy={`competence-tree-level-color-${index}`}
        />
        <label className="sr-only" htmlFor={hexId}>
          {t('manage.competenceTree.levelColorHex', { label: row.label })}
        </label>
        <input
          id={hexId}
          type="text"
          value={draft}
          placeholder={row.defaultColor}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            const result = normalizeAdaptiveLevelColor(next)
            if (result.valid) onChange(result.color)
          }}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={messageId}
          className={`h-8 w-24 rounded border px-2 font-mono text-sm disabled:bg-slate-100 ${
            invalid ? 'border-red-600' : 'border-slate-300'
          }`}
          data-cy={`competence-tree-level-color-hex-${index}`}
        />
        <span
          className="w-14 text-xs text-slate-600"
          data-cy={`competence-tree-level-color-state-${index}`}
        >
          {row.override
            ? t('manage.competenceTree.levelColorCustom')
            : t('manage.competenceTree.levelColorDefault')}
        </span>
        <IconAction
          icon={faRotateLeft}
          label={t('manage.competenceTree.levelColorReset')}
          onClick={() => {
            setDraft('')
            onChange(null)
          }}
          disabled={disabled || (!row.override && draft === '')}
          dataCy={`competence-tree-level-color-reset-${index}`}
        />
      </div>
      <p id={messageId} className="text-xs" aria-live="polite">
        {invalid ? (
          <span className="text-red-700">
            {t('manage.competenceTree.levelColorInvalid')}
          </span>
        ) : row.lowContrast ? (
          <span
            className="text-amber-800"
            data-cy={`competence-tree-level-color-contrast-${index}`}
          >
            {t('manage.competenceTree.levelColorLowContrast')}
          </span>
        ) : null}
      </p>
    </div>
  )
}

/** Same band colors and group separators as the student result views. */
export function LevelColorPreview({ rows }: { rows: LevelColorRow[] }) {
  const t = useTranslations()
  if (rows.length === 0) return null
  return (
    <figure className="mt-4" data-cy="competence-tree-level-color-preview">
      <figcaption className="mb-1 text-xs font-semibold text-slate-600">
        {t('manage.competenceTree.levelColorPreview')}
      </figcaption>
      <div className="flex h-9 overflow-hidden rounded border border-slate-200 bg-white">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="relative flex min-w-0 flex-1 items-center justify-center text-[11px] font-medium"
            style={{
              backgroundColor: row.color,
              color:
                contrastRatio(row.color, '#0f172a') >=
                contrastRatio(row.color, '#ffffff')
                  ? '#0f172a'
                  : '#ffffff',
              borderRight:
                index < rows.length - 1
                  ? `${row.groupEnd ? 3 : 1}px solid #ffffff`
                  : undefined,
            }}
            title={`${row.label}: ${row.color}`}
          >
            <span className="truncate pl-1 pr-3">{row.label}</span>
            <span
              className="absolute inset-y-1 right-1.5 w-0.5"
              style={{
                backgroundColor: ADAPTIVE_LEVEL_MARKER_COLOR,
                boxShadow: '0 0 0 1px #ffffff',
                opacity: 0.85,
              }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </figure>
  )
}
