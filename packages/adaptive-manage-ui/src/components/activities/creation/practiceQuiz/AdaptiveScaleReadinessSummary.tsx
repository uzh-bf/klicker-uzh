import { useQuery } from '@apollo/client'
import {
  AdaptiveEmpiricalValidationStatus,
  AdaptiveScaleVersionStatus,
  CompetenceTreeCalibrationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import CalibrationStatus from '../../../resources/competenceTrees/CalibrationStatus'

function AdaptiveScaleReadinessSummary({
  treeId,
  selectedScaleVersionId,
  autoSelectActiveScale,
  onScaleVersionChange,
}: {
  treeId: string
  selectedScaleVersionId?: string
  autoSelectActiveScale: boolean
  onScaleVersionChange: (scaleVersionId: string) => void
}) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(CompetenceTreeCalibrationDocument, {
    variables: { treeId },
    fetchPolicy: 'cache-and-network',
  })

  const scales = data?.competenceTreeCalibration.scales ?? []
  const activeScale = scales.find(
    (scale) => scale.status === AdaptiveScaleVersionStatus.Active
  )
  const configuredScale = scales.find(
    (scale) => scale.id === selectedScaleVersionId
  )
  const selectedScale = configuredScale ?? activeScale

  useEffect(() => {
    if (
      autoSelectActiveScale &&
      activeScale &&
      activeScale.id !== selectedScaleVersionId &&
      data?.competenceTreeCalibration.treeId === treeId
    ) {
      onScaleVersionChange(activeScale.id)
    }
  }, [
    activeScale,
    autoSelectActiveScale,
    data?.competenceTreeCalibration.treeId,
    onScaleVersionChange,
    selectedScaleVersionId,
    treeId,
  ])

  if (loading && !data) return <Loader />
  if (error) {
    return (
      <UserNotification
        type="error"
        message={error.message}
        data={{ cy: 'adaptive-scale-readiness-error' }}
      />
    )
  }

  if (!selectedScale) {
    return (
      <UserNotification
        type="warning"
        message={t('manage.activityWizard.adaptive.scale.noActive')}
        data={{ cy: 'adaptive-scale-readiness-no-active' }}
      />
    )
  }

  const standardSettingApproved = selectedScale.approvals.some(
    (approval) => approval.decision === AdaptiveScaleVersionStatus.Approved
  )
  const empiricalValidationApproved = selectedScale.empiricalValidations.some(
    (validation) =>
      validation.status === AdaptiveEmpiricalValidationStatus.Approved
  )

  return (
    <section
      className="border-uzh-grey-80 border-y py-3"
      data-cy="adaptive-scale-readiness-summary"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-bold">
          {t('manage.activityWizard.adaptive.scale.title')}
        </div>
        <div className="text-sm" data-cy="adaptive-selected-scale-version">
          {t('manage.activityWizard.adaptive.scale.version', {
            version: selectedScale.version,
          })}
        </div>
      </div>
      <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
        <ReadinessLine
          ready={standardSettingApproved}
          label={t('manage.activityWizard.adaptive.scale.standardSetting')}
        />
        <ReadinessLine
          ready={empiricalValidationApproved}
          label={t('manage.activityWizard.adaptive.scale.empiricalValidation')}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <CalibrationStatus
          status="CALIBRATED"
          count={selectedScale.calibrationCounts.calibrated}
        />
        <CalibrationStatus
          status="PILOT"
          count={selectedScale.calibrationCounts.pilot}
        />
        <CalibrationStatus
          status="PROVISIONAL"
          count={selectedScale.calibrationCounts.provisional}
        />
        <CalibrationStatus
          status="FLAGGED"
          count={selectedScale.calibrationCounts.flagged}
        />
      </div>
      {activeScale && activeScale.id !== selectedScaleVersionId ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0 text-sm">
            {t(
              selectedScaleVersionId
                ? 'manage.activityWizard.adaptive.scale.newerActiveAvailable'
                : 'manage.activityWizard.adaptive.scale.legacyMeasurement',
              { version: activeScale.version }
            )}
          </div>
          <Button
            primary
            type="button"
            onClick={() => onScaleVersionChange(activeScale.id)}
            data={{ cy: 'adaptive-use-active-scale' }}
          >
            {t('manage.activityWizard.adaptive.scale.useActive', {
              version: activeScale.version,
            })}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function ReadinessLine({ ready, label }: { ready: boolean; label: string }) {
  const t = useTranslations()
  return (
    <div
      className={
        ready
          ? 'border-l-2 border-green-700 pl-2 text-green-900'
          : 'border-l-2 border-amber-700 pl-2 text-amber-900'
      }
    >
      {label}: {t(ready ? 'shared.generic.yes' : 'shared.generic.no')}
    </div>
  )
}

export default AdaptiveScaleReadinessSummary
