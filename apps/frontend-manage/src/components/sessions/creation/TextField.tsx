import { Label } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { twMerge } from 'tailwind-merge'

interface TextFieldProps {
  id?: string
  label?: string
  tooltip?: string
  className?: {
    root?: string
    label?: string
    input?: string
    error?: string
  }
}

// type structure ensures that either a name or a value and onChange function are passed
interface TextFieldWithNameProps extends TextFieldProps {
  name: string
  value?: never
  onChange?: never
}
interface TextFieldWithOnChangeProps extends TextFieldProps {
  name?: never
  value: string
  onChange: (newValue: string) => void
}

function TextField({
  name,
  value,
  onChange,
  id,
  label,
  tooltip,
  className,
}: TextFieldWithNameProps | TextFieldWithOnChangeProps) {
  const [field, meta, helpers] = useField(name || 'missing')
  return (
    <div className={twMerge('flex flex-col', className?.root)} id={id}>
      <div className="flex flex-row w-full">
        {label && (
          <Label
            label={label}
            className={twMerge(
              'my-auto mr-2 font-bold min-w-max',
              className?.label
            )}
            tooltip={tooltip}
            tooltipStyle="text-sm font-normal !w-1/2 opacity-100"
            showTooltipSymbol={typeof tooltip !== 'undefined'}
          />
        )}
        {name && (
          <input
            {...field}
            name={name}
            type="text"
            className={twMerge(
              'w-full rounded bg-uzh-grey-20 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
              meta.error && meta.touched && 'border-red-400 bg-red-50',
              className?.input
            )}
          />
        )}
        {typeof value !== undefined && onChange && (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type="text"
            className={twMerge(
              'w-full rounded bg-uzh-grey-20 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
              meta.error && meta.touched && 'border-red-400 bg-red-50',
              className?.input
            )}
          />
        )}
      </div>
      {meta.touched && meta.error ? (
        <div
          className={twMerge(
            'w-full text-sm text-right text-red-400',
            className?.error
          )}
        >
          {meta.error}
        </div>
      ) : null}
    </div>
  )
}

export default TextField
