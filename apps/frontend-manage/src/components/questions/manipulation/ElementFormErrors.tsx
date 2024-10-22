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
          <li>{`${t('manage.questionForms.questionTitle')}: ${
            errors.name
          }`}</li>
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
          'solutionRanges' in errors.options &&
          errors.options.solutionRanges &&
          typeof errors.options.solutionRanges === 'string' && (
            <li>{`${t('manage.questionForms.solutionRanges')}: ${
              errors.options.solutionRanges
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
      </ul>
    </UserNotification>
  )
}

export default ElementFormErrors
