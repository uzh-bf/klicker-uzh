import { Label } from '@uzh-bf/design-system'
import { useField } from 'formik'
import ContentInput from 'shared-components/src/ContentInput'
import { twMerge } from 'tailwind-merge'

interface EditorFieldProps {
  label: string
  fieldName: string
  tooltip?: string
  className?: string
}

function EditorField({
  label,
  fieldName,
  tooltip,
  className,
}: EditorFieldProps) {
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
        showToolbarOnFocus={true}
        placeholder="Inhalt hier eingeben…"
        className={{
          editor: '!leading-3 h-14 overflow-x-auto',
          root: 'w-full',
        }}
      />
    </div>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default EditorField
