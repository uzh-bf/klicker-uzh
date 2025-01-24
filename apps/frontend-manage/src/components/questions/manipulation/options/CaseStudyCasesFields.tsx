import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, FormikTextField, FormLabel, H3 } from '@uzh-bf/design-system'
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FormikErrors,
  useField,
} from 'formik'
import { useTranslations } from 'next-intl'
import ContentInput from '../../../common/ContentInput'
import { ElementFormTypes, ElementFormTypesCaseStudy } from '../types'

export interface CaseStudySetterProps {
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
  setFieldTouched: (
    field: string,
    isTouched?: boolean,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

function CaseStudyCasesFields({
  setFieldValue,
  setFieldTouched,
}: CaseStudySetterProps) {
  const t = useTranslations()
  const [casesField, _, __] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')

  return (
    <div>
      <FieldArray name="options.cases">
        {({ push, remove }) => (
          <div className="flex flex-col gap-4">
            {casesField.value?.map((_, ix) => (
              <div key={ix} className="flex flex-col">
                <div className="-mb-1 flex items-center justify-between">
                  <H3>
                    {t('shared.generic.case')} {ix + 1}
                  </H3>
                  <Button
                    type="button"
                    // TODO: add confirmation step before removing
                    onClick={() => remove(ix)}
                    className={{
                      root: 'border-red-600 hover:border-red-600 hover:text-red-600',
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                    {t('manage.questionForms.removeCase')}
                  </Button>
                </div>
                <FormikTextField
                  required
                  name={`options.cases.${ix}.name`}
                  label={t('manage.questionForms.caseName')}
                  tooltip={t('manage.questionForms.caseStudyCaseNameTooltip')}
                  className={{ root: 'mb-1' }}
                />
                <FastField
                  name={`options.cases.${ix}.description`}
                  shouldUpdate={(next: any, prev: any) =>
                    next?.formik.values.options.cases[ix].description !==
                    prev?.formik.values.options.cases[ix].description
                  }
                >
                  {({ field, meta }: FastFieldProps) => (
                    <div className="w-full">
                      <FormLabel
                        required
                        label={t('manage.questionForms.caseDescription')}
                        labelType="small"
                        tooltip={t(
                          'manage.questionForms.caseStudyCaseDescriptionTooltip'
                        )}
                      />
                      <ContentInput
                        error={meta.error}
                        touched={meta.touched}
                        content={field.value || '<br>'}
                        onChange={(newValue: string) => {
                          setFieldValue(
                            `options.cases.${ix}.description`,
                            newValue
                          )
                          setFieldTouched(
                            `options.cases.${ix}.description`,
                            true
                          )
                        }}
                        placeholder={t(
                          'manage.questionForms.caseDescriptionPlaceholder'
                        )}
                        showToolbarOnFocus={false}
                        className={{ content: 'max-w-none' }}
                      />
                    </div>
                  )}
                </FastField>
                <hr className="border-uzh-grey-40 border-1 mt-4 w-full" />
              </div>
            ))}
            <Button
              type="button"
              onClick={() => push({ name: undefined, description: '' })}
              className={{
                root: 'border-primary-80 justify-center font-semibold',
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              {t('manage.questionForms.addCase')}
            </Button>
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default CaseStudyCasesFields
