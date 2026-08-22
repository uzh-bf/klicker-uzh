import { useMutation, useQuery } from '@apollo/client'
import {
  BetaFeaturesDocument,
  SetBetaFeaturesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import SimpleSetting from './SimpleSetting'

/**
 * Opt-in switch for lecturer-facing beta surfaces.
 *
 * The state lives in a GrowthBook saved group rather than the Klicker
 * database, so a `null` answer means GrowthBook could not be reached and the
 * setting hides itself instead of showing a switch position it cannot vouch
 * for. Mount this only for Catalyst accounts; the query rejects anyone else.
 */
function BetaFeaturesSetting() {
  const t = useTranslations()
  const [failed, setFailed] = useState(false)
  const { data } = useQuery(BetaFeaturesDocument, { errorPolicy: 'ignore' })
  const [setBetaFeatures, { loading }] = useMutation(SetBetaFeaturesDocument)

  const enabled = data?.betaFeatures

  if (typeof enabled !== 'boolean') {
    return null
  }

  return (
    <SimpleSetting
      label={t('manage.settings.betaFeatures')}
      tooltip={t('manage.settings.betaFeaturesTooltip')}
    >
      <div className="flex flex-row items-center gap-2">
        {failed && (
          <div className="text-destructive text-sm font-normal">
            {t('manage.settings.betaFeaturesError')}
          </div>
        )}
        <Switch
          checked={enabled}
          disabled={loading}
          onCheckedChange={async (checked) => {
            setFailed(false)
            try {
              await setBetaFeatures({
                refetchQueries: [BetaFeaturesDocument],
                variables: { enabled: checked },
              })
            } catch {
              // The mutation writes to an external service, so a failure has
              // to be shown rather than swallowed: the switch would otherwise
              // spring back with no explanation.
              setFailed(true)
            }
          }}
          data={{ cy: 'beta-features-switch' }}
        />
      </div>
    </SimpleSetting>
  )
}

export default BetaFeaturesSetting
