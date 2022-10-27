import { Label } from '@uzh-bf/design-system'
import { ErrorMessage, Field } from 'formik'
import { twMerge } from 'tailwind-merge'

interface TextFieldProps {
  label: string
  field: string
  error?: string
  touched?: boolean
  tooltip?: string
  className?: string
}

function TextField({ label, field, error, touched, tooltip, className }: TextFieldProps) {
  return (
    <div className={className}>
      <div className="flex flex-row w-full">
        <Label
          label={label}
          className="my-auto mr-2 font-bold min-w-max"
          tooltip={tooltip}
          tooltipStyle="text-sm font-normal !w-1/2 opacity-100"
          showTooltipSymbol={typeof tooltip !== 'undefined'}
        />
        <Field
          name={field}
          type="text"
          className={twMerge(
            'w-full rounded bg-uzh-grey-20 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
            error && touched && 'border-red-400 bg-red-50'
          )}
        />
      </div>
      <div className="w-full text-right">
        <ErrorMessage
          name={field}
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </div>
  )
}

export default TextField
