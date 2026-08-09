import {
  Button,
  FormikNumberField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesFreeText } from '../types'

interface FreeTextOptionsProps {
  inputsDisabled?: boolean
  values: ElementFormTypesFreeText
}

function FreeTextOptions({ inputsDisabled, values }: FreeTextOptionsProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-row items-center">
        <FormikNumberField
          disabled={inputsDisabled}
          name="options.restrictions.maxLength"
          label={t('manage.elements.maximumLength')}
          className={{
            field: 'w-44',
          }}
          placeholder={t('manage.elements.answerLength')}
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
                      // Formik solution arrays contain plain strings without a persisted identity; the field index is their controlled identity.
                      // biome-ignore lint/suspicious/noArrayIndexKey: index is the only stable identity available for this controlled Formik array
                      key={`${index}-${values.options.solutions!.length}`}
                    >
                      <FormikTextField
                        required
                        disabled={inputsDisabled}
                        name={`options.solutions.${index}`}
                        label={t('manage.elements.possibleSolutionN', {
                          number: String(index + 1),
                        })}
                        type="text"
                        placeholder={t('shared.generic.solution')}
                        data={{ cy: `set-solution-ix-${index}` }}
                      />
                      {!inputsDisabled ? (
                        <Button
                          destructive
                          onClick={() => remove(index)}
                          className={{
                            root: 'h-9',
                          }}
                          data={{
                            cy: `delete-solution-ix-${index}`,
                          }}
                        >
                          {t('shared.generic.delete')}
                        </Button>
                      ) : null}
                    </div>
                  ))
                : null}
              {!inputsDisabled ? (
                <Button
                  fluid
                  className={{
                    root: 'mt-1 h-8 border-gray-300 font-bold',
                  }}
                  onClick={() => push('')}
                  data={{ cy: 'add-solution-value' }}
                >
                  {t('manage.elements.addSolution')}
                </Button>
              ) : null}
            </div>
          )}
        </FieldArray>
      )}
    </div>
  )
}

export default FreeTextOptions
