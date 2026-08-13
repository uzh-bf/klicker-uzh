import {
  Button,
  FormikNumberField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { ElementFormTypesFreeText } from '../types'

interface FreeTextOptionsProps {
  inputsDisabled?: boolean
  values: ElementFormTypesFreeText
}

let nextFreeTextSolutionClientId = 0

function createFreeTextSolutionClientId(): string {
  return `solution-${nextFreeTextSolutionClientId++}`
}

function FreeTextOptions({ inputsDisabled, values }: FreeTextOptionsProps) {
  const t = useTranslations()
  const solutionClientIds = useRef<string[]>([])
  const getSolutionClientIds = (length: number) => {
    while (solutionClientIds.current.length < length) {
      solutionClientIds.current.push(createFreeTextSolutionClientId())
    }
    return solutionClientIds.current
  }

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
          {({ push, remove }: FieldArrayRenderProps) => {
            const clientIds = getSolutionClientIds(
              values.options.solutions?.length ?? 0
            )

            return (
              <div className="flex w-max flex-col gap-1">
                {values.options.solutions
                  ? values.options.solutions.map((_solution, index) => (
                      <div
                        className="flex flex-row items-end gap-2"
                        key={clientIds[index]}
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
                            onClick={() => {
                              solutionClientIds.current.splice(index, 1)
                              remove(index)
                            }}
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
                    onClick={() => {
                      solutionClientIds.current.push(
                        createFreeTextSolutionClientId()
                      )
                      push('')
                    }}
                    data={{ cy: 'add-solution-value' }}
                  >
                    {t('manage.elements.addSolution')}
                  </Button>
                ) : null}
              </div>
            )
          }}
        </FieldArray>
      )}
    </div>
  )
}

export default FreeTextOptions
