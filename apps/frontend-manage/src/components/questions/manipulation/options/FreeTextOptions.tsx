import {
  Button,
  FormikNumberField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { QuestionFormTypesFreeText } from '../types'

interface FreeTextOptionsProps {
  values: QuestionFormTypesFreeText
}

function FreeTextOptions({ values }: FreeTextOptionsProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-row items-center">
        <FormikNumberField
          name="options.restrictions.maxLength"
          label={t('manage.questionForms.maximumLength')}
          className={{
            field: 'w-44',
          }}
          placeholder={t('manage.questionForms.answerLength')}
          precision={0}
          data={{ cy: 'set-free-text-length' }}
          hideError
        />
      </div>
      {values.options.hasSampleSolution && (
        <FieldArray name="options.solutions">
          {({ push, remove }: FieldArrayRenderProps) => (
            <div className="flex w-max flex-col gap-1">
              {values.options.solutions
                ? values.options.solutions.map((_solution, index) => (
                    <div
                      className="flex flex-row items-end gap-2"
                      key={`${index}-${values.options.solutions!.length}`}
                    >
                      <FormikTextField
                        required
                        name={`options.solutions.${index}`}
                        label={t('manage.questionForms.possibleSolutionN', {
                          number: String(index + 1),
                        })}
                        type="text"
                        placeholder={t('shared.generic.solution')}
                      />
                      <Button
                        onClick={() => remove(index)}
                        className={{
                          root: 'ml-2 h-9 bg-red-500 text-white hover:bg-red-600',
                        }}
                        data={{
                          cy: `delete-solution-ix-${index}`,
                        }}
                      >
                        {t('shared.generic.delete')}
                      </Button>
                    </div>
                  ))
                : null}
              <Button
                fluid
                className={{
                  root: 'border-uzh-grey-100 flex-1 border border-solid font-bold',
                }}
                onClick={() => push('')}
                data={{ cy: 'add-solution-value' }}
              >
                {t('manage.questionForms.addSolution')}
              </Button>
            </div>
          )}
        </FieldArray>
      )}
    </div>
  )
}

export default FreeTextOptions
