import { FormikSwitchField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { ElementType } from '../../../../lib/constants/elementTypes'
import { ElementFormTypes } from '../types'

function AnswerFeedbackSetting({
  disabled,
  values,
}: {
  disabled: boolean
  values: ElementFormTypes
}) {
  const t = useTranslations()

  return values.type === ElementType.Sc ||
    values.type === ElementType.Mc ||
    values.type === ElementType.Kprim ? (
    <FormikSwitchField
      name="options.hasAnswerFeedbacks"
      label={t('manage.questionPool.answerFeedbacks')}
      disabled={disabled || !values.options.hasSampleSolution}
      data={{ cy: 'configure-answer-feedbacks' }}
      className={{
        root: twMerge(!values.options.hasSampleSolution && 'opacity-50'),
        label: 'text-gray-600',
      }}
    />
  ) : null
}

export default AnswerFeedbackSetting
