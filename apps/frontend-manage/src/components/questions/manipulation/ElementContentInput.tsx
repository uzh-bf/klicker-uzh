import { FormLabel } from '@uzh-bf/design-system'
import { FastField, FastFieldProps, FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import ContentInput from '../../common/ContentInput'
import { ElementFormTypes } from './types'

interface ElementContentInputProps {
  values: ElementFormTypes
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

function ElementContentInput({
  values,
  setFieldValue,
}: ElementContentInputProps) {
  const t = useTranslations()

  return (
    <div className="mt-4">
      <FastField
        name="content"
        questionType={values.type}
        shouldUpdate={(
          next?: { formik: { values: ElementFormTypes } },
          prev?: { formik: { values: ElementFormTypes } }
        ) =>
          next?.formik.values.content !== prev?.formik.values.content ||
          next?.formik.values.type !== prev?.formik.values.type
        }
      >
        {({ field, meta }: FastFieldProps) => (
          <>
            <FormLabel
              required
              label={t('shared.generic.question')}
              labelType="small"
              tooltip={t('manage.questionForms.questionTooltip')}
            />
            <ContentInput
              autoFocus
              error={meta.error}
              touched={meta.touched}
              content={field.value || '<br>'}
              onChange={(newValue: string) =>
                setFieldValue('content', newValue)
              }
              showToolbarOnFocus={false}
              placeholder={t('manage.questionForms.questionPlaceholder')}
              key={`${values.type}-content`}
              data={{ cy: 'insert-question-text' }}
              className={{ content: 'max-w-none' }}
            />
          </>
        )}
      </FastField>
    </div>
  )
}

export default ElementContentInput
