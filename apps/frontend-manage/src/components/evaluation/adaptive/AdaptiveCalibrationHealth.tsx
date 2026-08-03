import { useQuery } from '@apollo/client'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import {
  CompetenceTreeCalibrationDocument,
  CompetenceTreeCalibrationReadinessStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

function AdaptiveCalibrationHealth({ treeId }: { treeId: string }) {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading, error } = useQuery(CompetenceTreeCalibrationDocument, {
    variables: { treeId },
    fetchPolicy: 'network-only',
  })

  if (loading) {
    return (
      <section className="border-t border-gray-200 py-6">
        <Loader data={{ cy: 'adaptive-calibration-health-loading' }} />
      </section>
    )
  }

  const calibration = data?.competenceTreeCalibration
  if (error || !calibration) {
    return (
      <section className="border-t border-gray-200 py-6">
        <UserNotification
          type="error"
          message={t('manage.evaluation.adaptive.calibration.loadFailed')}
          data={{ cy: 'adaptive-calibration-health-error' }}
        />
      </section>
    )
  }

  const readiness = calibration.readiness
  const ready =
    readiness.status === CompetenceTreeCalibrationReadinessStatus.CalibratedBank

  return (
    <section
      className="border-t border-gray-200 py-6"
      data-cy="adaptive-evaluation-calibration-health"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <H3 className={{ root: 'mb-0' }}>
          {t('manage.evaluation.adaptive.calibration.title')}
        </H3>
        {calibration.canManage ? (
          <Button
            basic
            onClick={() =>
              void router.push(`/resources/competenceTrees/${treeId}`)
            }
            data={{ cy: 'adaptive-calibration-health-open-tree' }}
          >
            <Button.Icon icon={faArrowUpRightFromSquare} />
            <Button.Label>
              {t('manage.evaluation.adaptive.calibration.openTree')}
            </Button.Label>
          </Button>
        ) : null}
      </div>
      <UserNotification
        type={ready ? 'success' : 'warning'}
        message={t(
          `manage.competenceTree.scale.readinessStatus.${readiness.status}`
        )}
        className={{ root: ready ? 'mb-4 !text-slate-800' : 'mb-4' }}
        data={{ cy: 'adaptive-calibration-health-status' }}
      />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
        <ReadinessValue
          label={t('manage.competenceTree.scale.activeScaleVersion')}
          value={readiness.activeScaleVersion ?? '-'}
        />
        <ReadinessValue
          label={t('manage.competenceTree.scale.enabledAssignments')}
          value={readiness.enabledAssignmentCount}
        />
        <ReadinessValue
          label={t('manage.competenceTree.scale.calibratedAssignments')}
          value={readiness.calibratedAssignmentCount}
        />
        <ReadinessValue
          label={t('manage.competenceTree.scale.blockingAssignments')}
          value={readiness.blockingAssignmentCount}
        />
      </dl>
    </section>
  )
}

function ReadinessValue({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div>
      <dt className="text-gray-600">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

export default AdaptiveCalibrationHealth
