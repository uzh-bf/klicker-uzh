import { Button, FormikNumberField, FormLabel } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { ElementFormTypesNumerical } from '../types'

let nextExactSolutionClientId = 0

function createExactSolutionClientId(): string {
  return `exact-solution-${nextExactSolutionClientId++}`
}

function NumericalExactSolutionsInput({
  disabled,
  exactSolutions,
  precision,
}: {
  disabled?: boolean
  exactSolutions: ElementFormTypesNumerical['options']['exactSolutions']
  precision?: string | null
}) {
  const t = useTranslations()
  const solutionClientIds = useRef<string[]>([])
  const getSolutionClientIds = (length: number) => {
    while (solutionClientIds.current.length < length) {
      solutionClientIds.current.push(createExactSolutionClientId())
    }
    return solutionClientIds.current
  }

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.elements.exactSolutions')}
        labelType="small"
        tooltip={t('manage.elements.exactSolutionsTooltip')}
      />
      <FieldArray name="options.exactSolutions">
        {({ push, remove }: FieldArrayRenderProps) => {
          const clientIds = getSolutionClientIds(exactSolutions?.length ?? 0)

          return (
            <div className="flex w-max flex-col gap-1">
              {exactSolutions?.map((_, index: number) => (
                <div
                  className="flex flex-row items-end gap-2"
                  key={clientIds[index]}
                >
                  <FormikNumberField
                    hideError
                    required={index === 0}
                    disabled={disabled}
                    name={`options.exactSolutions.${index}`}
                    label={t('shared.generic.value')}
                    placeholder={`${t('shared.generic.value')} ${index + 1}`}
                    precision={precision ? parseInt(precision) : undefined}
                    data={{
                      cy: `set-exact-solution-${index}`,
                    }}
                  />
                  {!disabled ? (
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
                        cy: `delete-exact-solution-${index}`,
                      }}
                    >
                      {t('shared.generic.delete')}
                    </Button>
                  ) : null}
                </div>
              ))}
              {!disabled ? (
                <Button
                  fluid
                  className={{
                    root: 'mt-1 h-8 border-gray-300 font-bold',
                  }}
                  onClick={() => {
                    solutionClientIds.current.push(
                      createExactSolutionClientId()
                    )
                    push(undefined)
                  }}
                  data={{ cy: 'add-exact-solution' }}
                >
                  {t('manage.elements.addExactSolution')}
                </Button>
              ) : null}
            </div>
          )
        }}
      </FieldArray>
    </div>
  )
}

export default NumericalExactSolutionsInput
