import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { FormikSwitchField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface SampleSolutionSettingProps {
  type: ElementType
}

function SampleSolutionSetting({ type }: SampleSolutionSettingProps) {
  const t = useTranslations()

  return QUESTION_GROUPS.ALL.includes(type) ? (
    <FormikSwitchField
      name="options.hasSampleSolution"
      label={t('shared.generic.sampleSolution')}
      data={{ cy: 'configure-sample-solution' }}
      className={{ label: 'text-gray-600' }}
    />
  ) : null
}

export default SampleSolutionSetting
