import { useMutation, useQuery } from '@apollo/client'
import {
  useFeatureFlag,
  useRefreshFeatureFlags,
} from '@klicker-uzh/feature-flags/react'
import {
  BetaEnrollmentDocument,
  SetBetaEnrollmentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Switch, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Setting from './Setting'
import SimpleSetting from './SimpleSetting'

type EnrollmentStatus =
  | 'idle'
  | 'pending'
  | 'saved'
  | 'refresh-failed'
  | 'error'

function BetaEnrollmentSettings() {
  const t = useTranslations()
  const aiBetaEnabled = useFeatureFlag('ai-beta')
  const refreshFeatureFlags = useRefreshFeatureFlags()
  const { data, loading, refetch } = useQuery(BetaEnrollmentDocument, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })
  const [setBetaEnrollment] = useMutation(SetBetaEnrollmentDocument)
  const [confirmedMembership, setConfirmedMembership] = useState<
    boolean | null | undefined
  >(undefined)
  const [status, setStatus] = useState<EnrollmentStatus>('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (loading && !data) {
    return <Loader />
  }

  const capability = data?.betaEnrollment
  if (!capability?.mayChange) {
    return null
  }

  const membership =
    confirmedMembership === undefined
      ? capability.membership
      : confirmedMembership
  const membershipKnown = typeof membership === 'boolean'
  const showUnavailable = !membershipKnown
  const hideClosedNonMember =
    membership === false && !capability.signupAvailable && status === 'idle'

  if (hideClosedNonMember) {
    return null
  }

  const canToggle =
    membershipKnown && (membership === true || capability.signupAvailable)
  const saving = status === 'pending'
  const accessConverged =
    status === 'saved' &&
    membershipKnown &&
    aiBetaEnabled === (membership === true)

  async function handleEnrollmentChange(enabled: boolean) {
    if (saving || isRefreshing) return

    setStatus('pending')

    try {
      const result = await setBetaEnrollment({ variables: { enabled } })
      const savedMembership = result.data?.setBetaEnrollment?.membership

      if (savedMembership !== enabled) {
        setStatus('error')
        return
      }

      setConfirmedMembership(savedMembership)
      setStatus('saved')
      setIsRefreshing(true)

      try {
        try {
          await refetch()
        } catch {
          // The mutation response remains the last confirmed membership.
        }

        const refreshed = await refreshFeatureFlags()
        if (!refreshed) {
          setStatus('refresh-failed')
        }
      } catch {
        setStatus('refresh-failed')
      } finally {
        setIsRefreshing(false)
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="beta-features" data-cy="beta-enrollment-section">
      <Setting title={t('manage.settings.betaFeaturesTitle')}>
        <div className="mb-5 flex flex-col gap-3">
          <p>{t('manage.settings.betaFeaturesDescription')}</p>
          <p className="text-sm text-gray-600">
            {t('manage.settings.betaFeaturesDataUse')}
          </p>

          {showUnavailable ? (
            <div data-cy="beta-enrollment-unavailable" role="status">
              <UserNotification type="info">
                {t('manage.settings.betaFeaturesUnavailable')}
              </UserNotification>
            </div>
          ) : (
            canToggle && (
              <SimpleSetting
                label={t('manage.settings.betaFeaturesEnrollment')}
                tooltip={t('manage.settings.betaFeaturesEnrollmentTooltip')}
              >
                <Switch
                  checked={membership === true}
                  disabled={saving || isRefreshing}
                  onCheckedChange={(enabled) =>
                    void handleEnrollmentChange(enabled)
                  }
                  aria-label={t('manage.settings.betaFeaturesEnrollment')}
                  data={{ cy: 'beta-enrollment-switch' }}
                />
              </SimpleSetting>
            )
          )}

          {status === 'saved' && !isRefreshing ? (
            <div
              data-cy={
                accessConverged
                  ? 'beta-enrollment-converged'
                  : 'beta-enrollment-saved'
              }
              role="status"
            >
              <UserNotification type="success">
                {t(
                  accessConverged
                    ? membership
                      ? 'manage.settings.betaFeaturesConvergedOn'
                      : 'manage.settings.betaFeaturesConvergedOff'
                    : 'manage.settings.betaFeaturesSaved'
                )}
              </UserNotification>
            </div>
          ) : null}

          {(saving || isRefreshing) && (
            <div data-cy="beta-enrollment-pending" role="status">
              <UserNotification type="info">
                {t(
                  saving
                    ? 'manage.settings.betaFeaturesPending'
                    : 'manage.settings.betaFeaturesRefreshing'
                )}
              </UserNotification>
            </div>
          )}

          {status === 'refresh-failed' && (
            <div data-cy="beta-enrollment-refresh-failure" role="alert">
              <UserNotification type="error">
                {t('manage.settings.betaFeaturesRefreshFailure')}
              </UserNotification>
            </div>
          )}

          {status === 'error' && (
            <div data-cy="beta-enrollment-error" role="alert">
              <UserNotification type="error">
                {t('manage.settings.betaFeaturesError')}
              </UserNotification>
            </div>
          )}
        </div>
      </Setting>
    </section>
  )
}

export default BetaEnrollmentSettings
