import { ElementType } from '@klicker-uzh/graphql/dist/ops'
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
  const labelMap: Record<
    ElementType,
    | 'shared.generic.question'
    | 'shared.generic.content'
    | 'shared.generic.instructions'
  > = {
    [ElementType.Content]: 'shared.generic.content',
    [ElementType.Flashcard]: 'shared.generic.question',
    [ElementType.Sc]: 'shared.generic.question',
    [ElementType.Mc]: 'shared.generic.question',
    [ElementType.Kprim]: 'shared.generic.question',
    [ElementType.Numerical]: 'shared.generic.question',
    [ElementType.FreeText]: 'shared.generic.question',
    [ElementType.Selection]: 'shared.generic.question',
    [ElementType.CaseStudy]: 'shared.generic.instructions',
  }

  const tooltipMap: Record<
    ElementType,
    | 'manage.questionForms.questionTooltip'
    | 'manage.questionForms.contentTooltip'
    | 'manage.questionForms.instructionsTooltip'
  > = {
    [ElementType.Content]: 'manage.questionForms.contentTooltip',
    [ElementType.Flashcard]: 'manage.questionForms.questionTooltip',
    [ElementType.Sc]: 'manage.questionForms.questionTooltip',
    [ElementType.Mc]: 'manage.questionForms.questionTooltip',
    [ElementType.Kprim]: 'manage.questionForms.questionTooltip',
    [ElementType.Numerical]: 'manage.questionForms.questionTooltip',
    [ElementType.FreeText]: 'manage.questionForms.questionTooltip',
    [ElementType.Selection]: 'manage.questionForms.questionTooltip',
    [ElementType.CaseStudy]: 'manage.questionForms.instructionsTooltip',
  }

  const placeholderMap: Record<
    ElementType,
    | 'manage.questionForms.questionPlaceholder'
    | 'manage.questionForms.contentPlaceholder'
    | 'manage.questionForms.instructionsPlaceholder'
  > = {
    [ElementType.Content]: 'manage.questionForms.contentPlaceholder',
    [ElementType.Flashcard]: 'manage.questionForms.questionPlaceholder',
    [ElementType.Sc]: 'manage.questionForms.questionPlaceholder',
    [ElementType.Mc]: 'manage.questionForms.questionPlaceholder',
    [ElementType.Kprim]: 'manage.questionForms.questionPlaceholder',
    [ElementType.Numerical]: 'manage.questionForms.questionPlaceholder',
    [ElementType.FreeText]: 'manage.questionForms.questionPlaceholder',
    [ElementType.Selection]: 'manage.questionForms.questionPlaceholder',
    [ElementType.CaseStudy]: 'manage.questionForms.instructionsPlaceholder',
  }

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
              label={t(labelMap[values.type])}
              labelType="small"
              tooltip={t(tooltipMap[values.type])}
            />
            <ContentInput
              error={meta.error}
              touched={meta.touched}
              content={field.value || '<br>'}
              onChange={(newValue: string) =>
                setFieldValue('content', newValue)
              }
              showToolbarOnFocus={false}
              placeholder={t(placeholderMap[values.type])}
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
