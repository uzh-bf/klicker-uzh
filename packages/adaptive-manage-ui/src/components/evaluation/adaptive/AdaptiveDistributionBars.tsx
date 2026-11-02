import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AdaptiveEstimatedDistribution from './AdaptiveEstimatedDistribution'
import type { AdaptiveCohortDistribution } from './types'

function AdaptiveDistributionBars({
  distribution,
  dataCy,
  cohortSize,
}: {
  distribution: AdaptiveCohortDistribution
  dataCy: string
  cohortSize: number | null
}) {
  const t = useTranslations()
  if (distribution.suppressed) {
    return (
      <UserNotification
        type="info"
        message={t('manage.evaluation.adaptive.suppression.distribution')}
        data={{ cy: `${dataCy}-suppressed` }}
      />
    )
  }
  return (
    <AdaptiveEstimatedDistribution
      distribution={distribution}
      cohortSize={cohortSize}
      dataCy={dataCy}
    />
  )
}
export default AdaptiveDistributionBars
