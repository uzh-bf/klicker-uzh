import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel } from '@uzh-bf/design-system'
import { FastField, FastFieldProps, FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import ContentInput from '../../common/ContentInput'
import { ElementFormTypes } from './types'

interface ElementExplanationFieldProps {
  values: ElementFormTypes
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

function ElementExplanationField({
  values,
  setFieldValue,
}: ElementExplanationFieldProps) {
  const t = useTranslations()

  return values.type !== ElementType.Content ? (
    <div className="mt-4">
      <FastField
        name="explanation"
        questionType={values.type}
        shouldUpdate={(
          next?: { formik: { values: ElementFormTypes } },
          prev?: { formik: { values: ElementFormTypes } }
        ) =>
          (next &&
            prev &&
            'explanation' in next.formik.values &&
            'explanation' in prev.formik.values &&
            next.formik.values.explanation !==
              prev?.formik.values.explanation) ||
          next?.formik.values.type !== prev?.formik.values.type
        }
      >
        {({ field, meta }: FastFieldProps) => (
          <>
            <FormLabel
              required={values.type === ElementType.Flashcard}
              label={t('shared.generic.explanation')}
              labelType="small"
              tooltip={t('manage.questionForms.explanationTooltip')}
            />
            <ContentInput
              error={meta.error}
              touched={meta.touched}
              content={field.value || '<br>'}
              onChange={(newValue: string) =>
                setFieldValue('explanation', newValue)
              }
              placeholder={t('manage.questionForms.explanationPlaceholder')}
              key={`${values.type}-explanation`}
              data={{ cy: 'insert-question-explanation' }}
            />
          </>
        )}
      </FastField>
    </div>
  ) : null
}

export default ElementExplanationField
