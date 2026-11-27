import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel } from '@uzh-bf/design-system'
import { FastField, FastFieldProps, FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import ContentInput from '../../common/ContentInput'
import { ElementFormTypes } from './types'

interface ElementContentInputProps {
  disabled?: boolean
  values: ElementFormTypes
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

function ElementContentInput({
  disabled = false,
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
    [ElementType.QrScan]: 'shared.generic.question',
  }

  const tooltipMap: Record<
    ElementType,
    | 'manage.elements.questionTooltip'
    | 'manage.elements.contentTooltip'
    | 'manage.elements.instructionsTooltip'
  > = {
    [ElementType.Content]: 'manage.elements.contentTooltip',
    [ElementType.Flashcard]: 'manage.elements.questionTooltip',
    [ElementType.Sc]: 'manage.elements.questionTooltip',
    [ElementType.Mc]: 'manage.elements.questionTooltip',
    [ElementType.Kprim]: 'manage.elements.questionTooltip',
    [ElementType.Numerical]: 'manage.elements.questionTooltip',
    [ElementType.FreeText]: 'manage.elements.questionTooltip',
    [ElementType.Selection]: 'manage.elements.questionTooltip',
    [ElementType.CaseStudy]: 'manage.elements.instructionsTooltip',
    [ElementType.QrScan]: 'manage.elements.questionTooltip',
  }

  const placeholderMap: Record<
    ElementType,
    | 'manage.elements.questionPlaceholder'
    | 'manage.elements.contentPlaceholder'
    | 'manage.elements.instructionsPlaceholder'
  > = {
    [ElementType.Content]: 'manage.elements.contentPlaceholder',
    [ElementType.Flashcard]: 'manage.elements.questionPlaceholder',
    [ElementType.Sc]: 'manage.elements.questionPlaceholder',
    [ElementType.Mc]: 'manage.elements.questionPlaceholder',
    [ElementType.Kprim]: 'manage.elements.questionPlaceholder',
    [ElementType.Numerical]: 'manage.elements.questionPlaceholder',
    [ElementType.FreeText]: 'manage.elements.questionPlaceholder',
    [ElementType.Selection]: 'manage.elements.questionPlaceholder',
    [ElementType.CaseStudy]: 'manage.elements.instructionsPlaceholder',
    [ElementType.QrScan]: 'manage.elements.questionPlaceholder',
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
              disabled={disabled}
              error={meta.error}
              touched={meta.touched}
              content={field.value || '<br>'}
              onChange={(newValue: string) =>
                setFieldValue('content', newValue)
              }
              showToolbarOnFocus={disabled} // show toolbar only when not disabled
              allowVideoEmbedding
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
