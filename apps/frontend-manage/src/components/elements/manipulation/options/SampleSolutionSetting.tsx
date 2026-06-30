import { FormikSwitchField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementType } from '../../../../lib/constants/elementTypes'

function SampleSolutionSetting({
  disabled = false,
  type,
}: {
  disabled: boolean
  type: ElementType
}) {
  const t = useTranslations()
  const supportsSampleSolution =
    type !== ElementType.Content && type !== ElementType.Flashcard

  return supportsSampleSolution ? (
    <FormikSwitchField
      size="sm"
      disabled={disabled}
      name="options.hasSampleSolution"
      label={t('manage.elements.enableSampleSolution')}
      data={{ cy: 'configure-sample-solution' }}
      className={{ label: 'text-gray-600' }}
    />
  ) : null
}

export default SampleSolutionSetting
