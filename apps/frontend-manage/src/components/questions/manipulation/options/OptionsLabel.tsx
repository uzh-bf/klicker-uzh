import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface OptionsLabelProps {
  type: ElementType
}

function OptionsLabel({ type }: OptionsLabelProps) {
  const t = useTranslations()

  return (
    <>
      {QUESTION_GROUPS.CHOICES.includes(type) && (
        <div className="flex-1">
          <FormLabel
            required
            label={t('manage.questionForms.answerOptions')}
            labelType="small"
            tooltip={t('manage.questionForms.answerOptionsTooltip')}
            className={{ label: 'text-black' }}
          />
        </div>
      )}
      {QUESTION_GROUPS.FREE.includes(type) && (
        <div className="flex-1">
          <FormLabel
            required
            label={t('shared.generic.options')}
            labelType="small"
            tooltip={
              type === ElementType.Numerical
                ? t('manage.questionForms.NUMERICALOptionsTooltip')
                : t('manage.questionForms.FTOptionsTooltip')
            }
            className={{ label: 'mb-1 text-black' }}
          />
        </div>
      )}
    </>
  )
}

export default OptionsLabel
