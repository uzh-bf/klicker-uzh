import { UserNotification } from '@uzh-bf/design-system'
import type { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import type { ElementFormTypes } from './types'

interface ElementFormErrorsProps {
  errors: FormikErrors<ElementFormTypes>
}

function ElementFormErrors({
  errors,
}: ElementFormErrorsProps): React.ReactElement {
  const t = useTranslations()

  return (
    <UserNotification
      className={{
        root: 'mt-8 p-4 text-base',
        icon: 'text-red-700',
        message: 'text-red-700',
      }}
      type="error"
    >
      <div>{t('manage.formErrors.resolveErrors')}</div>
      <ul className="ml-4 list-disc">
        {errors.name && (
          <li>{`${t('manage.elements.elementTitle')}: ${errors.name}`}</li>
        )}
        {errors.tags && (
          <li>{`${t('manage.questionPool.tags')}: ${errors.tags}`}</li>
        )}
        {errors.pointsMultiplier && (
          <li>{`${t('shared.generic.multiplier')}: ${
            errors.pointsMultiplier
          }`}</li>
        )}
        {errors.content && (
          <li>{`${t('shared.generic.question')}: ${errors.content}`}</li>
        )}
        {'explanation' in errors && errors.explanation && (
          <li>{`${t('shared.generic.explanation')}: ${errors.explanation}`}</li>
        )}

        {/* error messages specific to SC / MC / KP questions */}
        {'options' in errors &&
          errors.options &&
          'choices' in errors.options &&
          typeof errors.options.choices === 'object' &&
          (
            errors.options.choices as {
              value?: string
              feedback?: string
            }[]
          ).map(
            (choiceError, ix) =>
              choiceError && (
                <li key={`choice-${ix}`}>{`${t(
                  'manage.elements.answerOption'
                )} ${ix + 1}: ${
                  choiceError.value && choiceError.feedback
                    ? `${choiceError.value} ${choiceError.feedback}`
                    : choiceError.value || choiceError.feedback
                }`}</li>
              )
          )}
        {'options' in errors &&
          errors.options &&
          'choices' in errors.options &&
          errors.options.choices &&
          typeof errors.options.choices === 'string' && (
            <li>{`${t('manage.elements.answerOptions')}: ${
              errors.options.choices
            }`}</li>
          )}

        {/* error messages specific to NR questions */}
        {'options' in errors &&
          errors.options &&
          'accuracy' in errors.options &&
          errors.options.accuracy && (
            <li>{`${t('shared.generic.precision')}: ${
              errors.options.accuracy
            }`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'unit' in errors.options &&
          errors.options.unit && (
            <li>{`${t('shared.generic.unit')}: ${errors.options.unit}`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'solutionType' in errors.options &&
          errors.options.solutionType && (
            <li>{`${t('manage.elements.solutionTypeNumerical')}: ${
              errors.options.solutionType
            }`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'solutionRanges' in errors.options &&
          errors.options.solutionRanges &&
          (typeof errors.options.solutionRanges === 'string' ? (
            <li>{`${t('manage.elements.solutionRanges')}: ${
              errors.options.solutionRanges
            }`}</li>
          ) : (
            (errors.options.solutionRanges as string[]).map(
              (rangeError, ix) => (
                <li
                  key={`solution-range-error-${ix}`}
                >{`${t('manage.elements.solutionRanges')} ${ix + 1}: ${
                  rangeError
                }`}</li>
              )
            )
          ))}
        {'options' in errors &&
          errors.options &&
          'exactSolutions' in errors.options &&
          errors.options.exactSolutions &&
          typeof errors.options.exactSolutions === 'string' && (
            <li>{`${t('manage.elements.exactSolutions')}: ${
              errors.options.exactSolutions
            }`}</li>
          )}

        {/* error messages specific to FT questions */}
        {'options' in errors &&
          errors.options &&
          'restrictions' in errors.options &&
          errors.options.restrictions &&
          (errors.options.restrictions as { maxLength?: string }).maxLength && (
            <li>{`${t('manage.elements.answerLength')}: ${
              (
                errors.options.restrictions as {
                  maxLength?: string
                }
              ).maxLength
            }`}</li>
          )}

        {/* error messages specific to NR questions */}
        {'options' in errors &&
          errors.options &&
          'restrictions' in errors.options &&
          (errors.options.restrictions as { min?: string }).min && (
            <li>{`${t('manage.elements.restrictions')}: ${
              (errors.options.restrictions as { min?: string }).min
            }`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'restrictions' in errors.options &&
          (errors.options.restrictions as { max?: string }).max && (
            <li>{`${t('manage.elements.restrictions')}: ${
              (errors.options.restrictions as { max?: string }).max
            }`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'solutions' in errors.options &&
          typeof errors.options.solutions === 'object' &&
          (errors.options.solutions as any[]).map(
            (solutionError: any, ix: number) =>
              solutionError && (
                <li key={`solution-${ix}`}>{`${t(
                  'manage.elements.possibleSolutionN',
                  { number: String(ix + 1) }
                )}: ${solutionError}`}</li>
              )
          )}
        {'options' in errors &&
          errors.options &&
          'solutions' in errors.options &&
          errors.options.solutions &&
          typeof errors.options.solutions === 'string' && (
            <li>{`${t(
              'manage.elements.possibleSolutions'
            )}: ${errors.options.solutions}`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'semanticEvaluation' in errors.options &&
          errors.options.semanticEvaluation && (
            <li>{`${t('manage.elements.semanticEvaluation')}: ${String(
              errors.options.semanticEvaluation
            )}`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'semanticEvaluationLoadError' in errors.options &&
          errors.options.semanticEvaluationLoadError && (
            <li>{`${t('manage.elements.semanticEvaluation')}: ${String(
              errors.options.semanticEvaluationLoadError
            )}`}</li>
          )}

        {/* error messages specific to SE / CS questions */}
        {'options' in errors &&
          errors.options &&
          'answerCollection' in errors.options &&
          errors.options.answerCollection && (
            <li>{`${t('manage.elements.answerCollection')}: ${errors.options.answerCollection}`}</li>
          )}

        {/* error messages specific to SE questions */}
        {'options' in errors &&
          errors.options &&
          'numberOfInputs' in errors.options &&
          errors.options.numberOfInputs && (
            <li>{`${t('manage.elements.numberOfInputs')}: ${errors.options.numberOfInputs}`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'correctAnswers' in errors.options &&
          errors.options.correctAnswers && (
            <li>{`${t('manage.elements.correctAnswerOptions')}: ${errors.options.correctAnswers}`}</li>
          )}

        {/* error messages specific to CS questions */}
        {'options' in errors &&
          errors.options &&
          'selectedItems' in errors.options &&
          errors.options.selectedItems && (
            <li>{`${t('manage.elements.selectedItems')}: ${errors.options.selectedItems}`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'manuallyCreatedItems' in errors.options &&
          errors.options.manuallyCreatedItems && (
            <li>{`${t('manage.elements.definedItems')}: ${errors.options.manuallyCreatedItems}`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'criteria' in errors.options &&
          errors.options.criteria &&
          typeof errors.options.criteria === 'object' &&
          (
            errors.options.criteria as
              | {
                  id?: string
                  name?: string
                  min?: string
                  max?: string
                  step?: string
                  unit?: string
                }[]
              | string[]
          ).flatMap((criterionError, ix) => {
            if (typeof criterionError === 'string') {
              return [
                <li key={`criterion-${ix}-${criterionError}`}>
                  {`${t('shared.generic.criterion')} ${ix + 1}: ${criterionError}`}
                </li>,
              ]
            }

            return (
              criterionError &&
              Object.values(criterionError)
                .filter((error) => typeof error !== 'undefined')
                .map((error) => (
                  <li key={`criterion-${ix}-${error}`}>
                    {`${t('shared.generic.criterion')} ${ix + 1}: ${error}`}
                  </li>
                ))
            )
          })}
        {'options' in errors &&
          errors.options &&
          'criteria' in errors.options &&
          errors.options.criteria &&
          typeof errors.options.criteria === 'string' && (
            <li>
              {`${t('shared.generic.criteria')}: ${errors.options.criteria}`}
            </li>
          )}

        {'options' in errors &&
          errors.options &&
          'cases' in errors.options &&
          errors.options.cases &&
          typeof errors.options.cases === 'object' &&
          (
            errors.options.cases as {
              title?: string
              description?: string
              solutions?: string
            }[]
          ).map(
            (caseError, ix) =>
              caseError &&
              Object.values(caseError)
                .filter((error) => typeof error !== 'undefined')
                .map((error) => (
                  <li key={`case-${ix}-${error}`}>
                    {`${t('shared.generic.case')} ${ix + 1}: ${error}`}
                  </li>
                ))
          )}
        {'options' in errors &&
          errors.options &&
          'cases' in errors.options &&
          errors.options.cases &&
          typeof errors.options.cases === 'string' && (
            <li>{`${t('shared.generic.cases')}: ${errors.options.cases}`}</li>
          )}
      </ul>
    </UserNotification>
  )
}

export default ElementFormErrors
