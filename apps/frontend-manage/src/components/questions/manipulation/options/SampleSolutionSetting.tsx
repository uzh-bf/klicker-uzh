import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { FormikSwitchField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function SampleSolutionSetting({
  disabled = false,
  type,
}: {
  disabled: boolean
  type: ElementType
}) {
  const t = useTranslations()

  return QUESTION_GROUPS.ALL.includes(type) ? (
    <FormikSwitchField
      size="sm"
      disabled={disabled}
      name="options.hasSampleSolution"
      label={t('manage.elementForms.enableSampleSolution')}
      data={{ cy: 'configure-sample-solution' }}
      className={{ label: 'text-gray-600' }}
    />
  ) : null
}

export default SampleSolutionSetting
