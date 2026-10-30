import { ADAPTIVE_REQUIRED_CERTAINTY_OPTIONS } from '@klicker-uzh/adaptive-contract'
import { Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

const KEY = 'manage.activityWizard.adaptive.stopping'

// How certain the quiz must be before a competence counts as determined: the
// uncertainty interval must stay within ±1 or ±2 levels of the reported level
// (the engine's classification tolerance, at the quiz's fixed confidence).
function RequiredCertaintySelect({
  id,
  value,
  onChange,
  cy,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  cy: string
}) {
  const t = useTranslations()
  const label = (bands: number) =>
    bands === 0
      ? t(`${KEY}.certaintyExact`)
      : bands === 1
        ? t(`${KEY}.certainty1`)
        : bands === 2
          ? t(`${KEY}.certainty2`)
          : t(`${KEY}.certaintyWithin`, { count: bands })
  const offered = ADAPTIVE_REQUIRED_CERTAINTY_OPTIONS.map(String)
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      items={[
        ...offered.map((option) => ({
          value: option,
          label: label(Number(option)),
        })),
        // A stored value outside the offered ones (e.g. an exact level) stays
        // visible until it is changed.
        ...(offered.includes(value)
          ? []
          : [{ value, label: label(Number(value)) }]),
      ]}
      className={{ root: 'w-full', trigger: 'w-full' }}
      data={{ cy }}
    />
  )
}

export default RequiredCertaintySelect
