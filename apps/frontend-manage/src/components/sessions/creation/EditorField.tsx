import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormLabel, Tooltip } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentInput, { ContentInputClassName } from '../../common/ContentInput'

interface EditorFieldProps {
  label: string
  labelType?: 'small' | 'large'
  required?: boolean
  fieldName: string
  tooltip?: string
  placeholder?: string
  showToolbarOnFocus?: boolean
  className?: {
    root?: string
    label?: string
    tooltip?: string
    input?: ContentInputClassName
  }
  data?: {
    cy?: string
    test?: string
  }
}

function EditorField({
  label,
  labelType = 'small',
  required = false,
  fieldName,
  tooltip,
  placeholder,
  showToolbarOnFocus = true,
  className,
  data,
}: EditorFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField(fieldName)

  return (
    <div
      className={twMerge(
        'flex w-full flex-row',
        labelType === 'small' && 'flex-col',
        className?.root
      )}
    >
      {label && (
        <FormLabel
          label={label}
          labelType={labelType}
          required={required}
          tooltip={tooltip}
          className={className}
        />
      )}

      <div className="flex w-full flex-row items-center gap-2">
        <ContentInput
          error={meta.error}
          touched={meta.touched}
          content={field.value}
          onChange={(newValue: string) => {
            helpers.setValue(newValue)
            helpers.setTouched(true)
          }}
          showToolbarOnFocus={showToolbarOnFocus}
          placeholder={placeholder ?? t('manage.sessionForms.enterContentHere')}
          className={{
            ...className?.input,
            root: twMerge('w-full', className?.input?.root),
            editor: twMerge(
              'h-16 overflow-y-auto !leading-5',
              className?.input?.editor
            ),
            content: twMerge('pb-1', className?.input?.content),
          }}
          data={data}
        />
        {meta.error && meta.touched && (
          <Tooltip
            tooltip={meta.error}
            delay={0}
            className={{ tooltip: 'text-sm' }}
          >
            <FontAwesomeIcon
              icon={faCircleExclamation}
              className="mr-1 text-red-600"
            />
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default EditorField
