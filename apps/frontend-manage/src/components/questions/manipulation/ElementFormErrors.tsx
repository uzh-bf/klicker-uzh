import { UserNotification } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypes } from './types'

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
          <li>{`${t('manage.questionForms.elementTitle')}: ${errors.name}`}</li>
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
                  'manage.questionForms.answerOption'
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
            <li>{`${t('manage.questionForms.answerOptions')}: ${
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
            <li>{`${t('manage.questionForms.solutionTypeNumerical')}: ${
              errors.options.solutionType
            }`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'solutionRanges' in errors.options &&
          errors.options.solutionRanges &&
          (typeof errors.options.solutionRanges === 'string' ? (
            <li>{`${t('manage.questionForms.solutionRanges')}: ${
              errors.options.solutionRanges
            }`}</li>
          ) : (
            (errors.options.solutionRanges as string[]).map(
              (rangeError, ix) => (
                <li
                  key={`solution-range-error-${ix}`}
                >{`${t('manage.questionForms.solutionRanges')} ${ix + 1}: ${
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
            <li>{`${t('manage.questionForms.exactSolutions')}: ${
              errors.options.exactSolutions
            }`}</li>
          )}

        {/* error messages specific to FT questions */}
        {'options' in errors &&
          errors.options &&
          'restrictions' in errors.options &&
          errors.options.restrictions &&
          (errors.options.restrictions as { maxLength?: string }).maxLength && (
            <li>{`${t('manage.questionForms.answerLength')}: ${
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
            <li>{`${t('manage.questionForms.restrictions')}: ${
              (errors.options.restrictions as { min?: string }).min
            }`}</li>
          )}
        {'options' in errors &&
          errors.options &&
          'restrictions' in errors.options &&
          (errors.options.restrictions as { max?: string }).max && (
            <li>{`${t('manage.questionForms.restrictions')}: ${
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
                  'manage.questionForms.possibleSolutionN',
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
              'manage.questionForms.possibleSolutions'
            )}: ${errors.options.solutions}`}</li>
          )}

        {/* error messages specific to SE / CS questions */}
        {'options' in errors &&
          errors.options &&
          'answerCollection' in errors.options &&
          errors.options.answerCollection && (
            <li>{`${t('manage.questionForms.answerCollection')}: ${errors.options.answerCollection}`}</li>
          )}

        {/* error messages specific to SE questions */}
        {'options' in errors &&
          errors.options &&
          'numberOfInputs' in errors.options &&
          errors.options.numberOfInputs && (
            <li>{`${t('manage.questionForms.numberOfInputs')}: ${errors.options.numberOfInputs}`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'correctAnswers' in errors.options &&
          errors.options.correctAnswers && (
            <li>{`${t('manage.questionForms.correctAnswerOptions')}: ${errors.options.correctAnswers}`}</li>
          )}

        {/* error messages specific to CS questions */}
        {'options' in errors &&
          errors.options &&
          'selectedItems' in errors.options &&
          errors.options.selectedItems && (
            <li>{`${t('manage.questionForms.selectedItems')}: ${errors.options.selectedItems}`}</li>
          )}

        {'options' in errors &&
          errors.options &&
          'criteria' in errors.options &&
          errors.options.criteria &&
          typeof errors.options.criteria === 'object' &&
          (
            errors.options.criteria as {
              id?: string
              name?: string
              min?: string
              max?: string
              step?: string
              unit?: string
            }[]
          ).flatMap(
            (criterionError, ix) =>
              criterionError &&
              Object.values(criterionError)
                .filter((error) => typeof error !== 'undefined')
                .map((error) => (
                  <li key={`criterion-${ix}-${error}`}>
                    {`${t('shared.generic.criterion')} ${ix + 1}: ${error}`}
                  </li>
                ))
          )}
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
            }[]
          ).map(
            (criterionError, ix) =>
              criterionError &&
              Object.values(criterionError)
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

        {/* // TODO: error parsing for solutions of case study questions */}
      </ul>
    </UserNotification>
  )
}

export default ElementFormErrors
