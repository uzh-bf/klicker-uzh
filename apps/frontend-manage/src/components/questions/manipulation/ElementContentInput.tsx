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
    | 'manage.elementForms.questionTooltip'
    | 'manage.elementForms.contentTooltip'
    | 'manage.elementForms.instructionsTooltip'
  > = {
    [ElementType.Content]: 'manage.elementForms.contentTooltip',
    [ElementType.Flashcard]: 'manage.elementForms.questionTooltip',
    [ElementType.Sc]: 'manage.elementForms.questionTooltip',
    [ElementType.Mc]: 'manage.elementForms.questionTooltip',
    [ElementType.Kprim]: 'manage.elementForms.questionTooltip',
    [ElementType.Numerical]: 'manage.elementForms.questionTooltip',
    [ElementType.FreeText]: 'manage.elementForms.questionTooltip',
    [ElementType.Selection]: 'manage.elementForms.questionTooltip',
    [ElementType.CaseStudy]: 'manage.elementForms.instructionsTooltip',
  }

  const placeholderMap: Record<
    ElementType,
    | 'manage.elementForms.questionPlaceholder'
    | 'manage.elementForms.contentPlaceholder'
    | 'manage.elementForms.instructionsPlaceholder'
  > = {
    [ElementType.Content]: 'manage.elementForms.contentPlaceholder',
    [ElementType.Flashcard]: 'manage.elementForms.questionPlaceholder',
    [ElementType.Sc]: 'manage.elementForms.questionPlaceholder',
    [ElementType.Mc]: 'manage.elementForms.questionPlaceholder',
    [ElementType.Kprim]: 'manage.elementForms.questionPlaceholder',
    [ElementType.Numerical]: 'manage.elementForms.questionPlaceholder',
    [ElementType.FreeText]: 'manage.elementForms.questionPlaceholder',
    [ElementType.Selection]: 'manage.elementForms.questionPlaceholder',
    [ElementType.CaseStudy]: 'manage.elementForms.instructionsPlaceholder',
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
