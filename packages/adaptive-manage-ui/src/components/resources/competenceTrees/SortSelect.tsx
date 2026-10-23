import { useId } from 'react'
import { twMerge } from 'tailwind-merge'

// Small labelled native select for client-side list sorting. The visible
// label keeps the current sort discoverable for screen reader and sighted
// users alike.
function SortSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
  dataCy,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  dataCy?: string
}) {
  const id = useId()
  return (
    <div className={twMerge('min-w-0 text-sm', className)}>
      <label htmlFor={id} className="block">
        {label}
      </label>
      <select
        id={id}
        className="mt-1 block w-full rounded border border-slate-300 p-2"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        data-cy={dataCy}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SortSelect
