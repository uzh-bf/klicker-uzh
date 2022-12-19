import { Label } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../questions/ContentInput'

interface EditorFieldProps {
  label: string
  field: string
  fieldName: string
  setFieldValue: (
    name: string,
    value: string,
    shouldValidate?: boolean | undefined
  ) => void
  error?: string
  touched?: boolean
  tooltip?: string
  className?: string
}

function EditorField({
  label,
  field,
  fieldName,
  setFieldValue,
  error,
  touched,
  tooltip,
  className,
}: EditorFieldProps) {
  return (
    <div className={twMerge('flex flex-row w-full', className)}>
      <Label
        label={label}
        className={{
          root: 'my-auto mr-2 font-bold min-w-max',
          tooltip: 'text-sm font-normal !w-1/2',
        }}
        tooltip={tooltip}
        showTooltipSymbol={typeof tooltip !== 'undefined'}
      />
      <ContentInput
        error={error}
        touched={touched}
        content={field || '<br>'}
        onChange={(newValue: string) => setFieldValue(fieldName, newValue)}
        showToolbarOnFocus={true}
        placeholder="Inhalt hier eingeben…"
        className={{ editor: '!leading-3', root: 'w-full' }}
      />
    </div>
  )
}

export default EditorField
