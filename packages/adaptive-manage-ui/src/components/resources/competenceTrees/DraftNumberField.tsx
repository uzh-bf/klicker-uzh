import { NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { parseNumberDraft } from './numberDraft'

type ReportValidity = (fieldId: string, invalid: boolean) => void

const NumberFieldValidityContext = createContext<{
  hasInvalidNumberFields: boolean
  reportValidity: ReportValidity
} | null>(null)

/** Tracks which DraftNumberFields below it currently hold an invalid draft. */
export function NumberFieldValidityProvider({
  children,
}: {
  children: ReactNode
}) {
  const [invalidFieldIds, setInvalidFieldIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const reportValidity = useCallback<ReportValidity>((fieldId, invalid) => {
    setInvalidFieldIds((current) => {
      if (current.has(fieldId) === invalid) return current
      const next = new Set(current)
      if (invalid) next.add(fieldId)
      else next.delete(fieldId)
      return next
    })
  }, [])
  const value = useMemo(
    () => ({
      hasInvalidNumberFields: invalidFieldIds.size > 0,
      reportValidity,
    }),
    [invalidFieldIds, reportValidity]
  )

  return (
    <NumberFieldValidityContext.Provider value={value}>
      {children}
    </NumberFieldValidityContext.Provider>
  )
}

export function useHasInvalidNumberFields() {
  return useContext(NumberFieldValidityContext)?.hasInvalidNumberFields ?? false
}

/**
 * A NumberField for numeric form state that can be cleared while editing.
 * The text draft is kept locally; only valid numbers are passed to onChange,
 * and an invalid draft shows an error and blocks saving via the provider.
 */
function DraftNumberField({
  id,
  value,
  onChange,
  min,
  max,
  precision,
  label,
  disabled,
  data,
  className,
  showInlineError = true,
}: {
  id?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  precision?: number
  label?: string
  disabled?: boolean
  data?: { cy?: string }
  className?: { input?: string }
  showInlineError?: boolean
}) {
  const t = useTranslations()
  const reportValidity = useContext(NumberFieldValidityContext)?.reportValidity
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const [draft, setDraft] = useState(() => String(value))
  const [committedValue, setCommittedValue] = useState(value)

  // Reset the draft when the value is changed from outside this field.
  if (value !== committedValue) {
    setCommittedValue(value)
    setDraft(String(value))
  }

  const result = parseNumberDraft(draft, { min, max })
  const error =
    disabled || result.ok
      ? undefined
      : t(`manage.competenceTree.numberField.${result.error}`, {
          min: min ?? 0,
          max: max ?? 0,
        })
  const invalid = error !== undefined

  useEffect(() => {
    reportValidity?.(fieldId, invalid)
    return () => reportValidity?.(fieldId, false)
  }, [fieldId, invalid, reportValidity])

  return (
    <div>
      <NumberField
        id={id}
        value={draft}
        onChange={(nextDraft) => {
          setDraft(nextDraft)
          const parsed = parseNumberDraft(nextDraft, { min, max })
          if (parsed.ok) {
            setCommittedValue(parsed.value)
            onChange(parsed.value)
          }
        }}
        max={max}
        precision={precision}
        label={label}
        disabled={disabled}
        error={error}
        isTouched
        hideError={showInlineError}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && showInlineError ? errorId : undefined}
        data={data}
        className={className}
      />
      {invalid && showInlineError ? (
        <p
          id={errorId}
          className="text-destructive mt-1 text-xs"
          data-cy={data?.cy ? `${data.cy}-error` : undefined}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default DraftNumberField
