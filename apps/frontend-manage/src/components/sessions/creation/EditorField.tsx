import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Label, Tooltip } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../common/ContentInput'

interface EditorFieldProps {
  label: string
  labelType?: 'small' | 'large'
  required?: boolean
  fieldName: string
  tooltip?: string
  showToolbarOnFocus?: boolean
  className?: {
    root?: string
    label?: string
    tooltip?: string
  }
  data?: {
    cy?: string
    test?: string
  }
}

function EditorField({
  label,
  labelType = 'small',
  required,
  fieldName,
  tooltip,
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
        <Label
          required={required}
          label={label}
          className={{
            root: twMerge(
              'my-auto mr-2 min-w-max font-bold',
              labelType === 'small' && '-mb-1 text-sm leading-6 text-gray-600',
              className?.label
            ),
            tooltip: twMerge('text-sm font-normal', className?.tooltip),
            tooltipSymbol: twMerge(labelType === 'small' && 'h-2 w-2'),
          }}
          tooltip={tooltip}
          showTooltipSymbol={typeof tooltip !== 'undefined'}
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
          placeholder={t('manage.sessionForms.enterContentHere')}
          className={{
            editor: '!leading-5 h-16 overflow-x-auto',
            root: 'w-full',
            content: 'pb-1',
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
