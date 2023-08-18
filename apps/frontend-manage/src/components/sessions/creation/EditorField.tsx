import ContentInput from '@klicker-uzh/shared-components/src/ContentInput'
import { Label } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface EditorFieldProps {
  label: string
  fieldName: string
  tooltip?: string
  showToolbarOnFocus?: boolean
  className?: string
  data_cy?: string
}

function EditorField({
  label,
  fieldName,
  tooltip,
  showToolbarOnFocus = true,
  className,
  data_cy,
}: EditorFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField(fieldName)

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
        error={meta.error}
        touched={meta.touched}
        content={field.value || '<br>'}
        onChange={(newValue: string) => {
          helpers.setValue(newValue)
          helpers.setTouched(true)
        }}
        showToolbarOnFocus={showToolbarOnFocus}
        placeholder={t('manage.sessionForms.enterContentHere')}
        className={{
          editor: '!leading-3 h-14 overflow-x-auto',
          root: 'w-full',
        }}
        data_cy={data_cy}
      />
    </div>
  )
}

export default EditorField
