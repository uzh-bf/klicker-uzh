import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FormikSwitchField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypes } from '../types'

interface AnswerFeedbackSettingProps {
  values: ElementFormTypes
}

function AnswerFeedbackSetting({ values }: AnswerFeedbackSettingProps) {
  const t = useTranslations()

  return values.type === ElementType.Sc ||
    values.type === ElementType.Mc ||
    values.type === ElementType.Kprim ? (
    <FormikSwitchField
      name="options.hasAnswerFeedbacks"
      label={t('manage.questionPool.answerFeedbacks')}
      disabled={!values.options.hasSampleSolution}
      className={{
        root: twMerge(!values.options.hasSampleSolution && 'opacity-50'),
        label: 'text-gray-600',
      }}
    />
  ) : null
}

export default AnswerFeedbackSetting
