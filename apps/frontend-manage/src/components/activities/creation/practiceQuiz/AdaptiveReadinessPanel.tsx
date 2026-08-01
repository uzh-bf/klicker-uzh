import {
  faCircleCheck,
  faCircleExclamation,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AdaptivePracticeQuizReadinessDataFragment } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  asAdaptiveTranslator,
  formatAdaptiveReadinessIssue,
} from './adaptiveReadinessIssue'

export type AdaptiveReadinessData = AdaptivePracticeQuizReadinessDataFragment
export type AdaptiveReadinessIssueData = AdaptiveReadinessData['errors'][number]
export type AdaptiveCoverageReadinessData =
  AdaptiveReadinessData['coverages'][number]

function AdaptiveReadinessPanel({
  readiness,
  stale = false,
  rootNames,
}: {
  readiness?: AdaptiveReadinessData | null
  stale?: boolean
  rootNames?: ReadonlyMap<number, string>
}) {
  const t = useTranslations()

  if (!readiness) {
    return (
      <UserNotification
        type="info"
        message={t('manage.activityWizard.adaptive.readiness.notChecked')}
        data={{ cy: 'adaptive-readiness-not-checked' }}
      />
    )
  }

  return (
    <section
      className="border-uzh-grey-80 border-t pt-3"
      data-cy="adaptive-readiness-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <FontAwesomeIcon
            icon={readiness.ready ? faCircleCheck : faCircleExclamation}
            className={readiness.ready ? 'text-green-700' : 'text-red-700'}
          />
          <span data-cy="adaptive-readiness-status">
            {t(
              readiness.ready
                ? 'manage.activityWizard.adaptive.readiness.ready'
                : 'manage.activityWizard.adaptive.readiness.notReady'
            )}
          </span>
        </div>
        {stale ? (
          <span
            className="bg-uzh-grey-40 rounded px-2 py-1 text-xs"
            data-cy="adaptive-readiness-stale"
          >
            {t('manage.activityWizard.adaptive.readiness.stale')}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-5">
        <Metric
          label={t('manage.activityWizard.adaptive.readiness.expectedLength')}
          value={String(readiness.expectedQuestionCount)}
        />
        <Metric
          label={t('manage.activityWizard.adaptive.readiness.duration')}
          value={t('manage.activityWizard.adaptive.readiness.minutes', {
            value: readiness.estimatedDurationMinutes.toFixed(1),
          })}
        />
        <Metric
          label={t('manage.activityWizard.adaptive.readiness.roots')}
          value={String(readiness.enabledRootCount)}
        />
        <Metric
          label={t('manage.activityWizard.adaptive.readiness.leaves')}
          value={String(readiness.enabledLeafCount)}
        />
        <Metric
          label={t('manage.activityWizard.adaptive.readiness.assignments')}
          value={String(readiness.enabledAssignmentCount)}
        />
      </div>

      <IssueList
        title={t('manage.activityWizard.adaptive.readiness.errors')}
        issues={readiness.errors}
        type="error"
      />
      <IssueList
        title={t('manage.activityWizard.adaptive.readiness.warnings')}
        issues={readiness.warnings}
        type="warning"
      />

      {readiness.rootReachability.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <div className="mb-1 text-sm font-bold">
            {t('manage.activityWizard.adaptive.readiness.reachability')}
          </div>
          <table className="w-full min-w-[38rem] table-fixed text-left text-xs">
            <thead className="bg-uzh-grey-20">
              <tr>
                <th className="w-52 px-2 py-1">
                  {t('manage.activityWizard.adaptive.readiness.root')}
                </th>
                <th className="px-2 py-1">
                  {t('manage.activityWizard.adaptive.readiness.available')}
                </th>
                <th className="px-2 py-1">
                  {t('manage.activityWizard.adaptive.readiness.allocated')}
                </th>
                <th className="px-2 py-1">
                  {t('manage.activityWizard.adaptive.readiness.levels')}
                </th>
                <th className="px-2 py-1">
                  {t('manage.activityWizard.adaptive.readiness.minimumSe')}
                </th>
              </tr>
            </thead>
            <tbody>
              {readiness.rootReachability.map((root) => (
                <tr
                  key={root.nodeId}
                  className="border-uzh-grey-80 border-b"
                  data-cy={`adaptive-reachability-${root.nodeId}`}
                >
                  <td
                    className="truncate px-2 py-1 font-bold"
                    title={rootNames?.get(root.nodeId)}
                  >
                    {rootNames?.get(root.nodeId) ?? `#${root.nodeId}`}
                  </td>
                  <td className="px-2 py-1">{root.availableItemCount}</td>
                  <td className="px-2 py-1">{root.allocatedQuestionCount}</td>
                  <td className="px-2 py-1">
                    {root.classifiableLevelCount}/{root.levelCount}
                  </td>
                  <td className="px-2 py-1">
                    {typeof root.minimumReachableStandardError === 'number'
                      ? root.minimumReachableStandardError.toFixed(2)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-slate-600" title={label}>
        {label}
      </div>
      <div className="font-bold">{value}</div>
    </div>
  )
}

function IssueList({
  title,
  issues,
  type,
}: {
  title: string
  issues: AdaptiveReadinessIssueData[]
  type: 'error' | 'warning'
}) {
  const t = useTranslations()
  if (issues.length === 0) return null

  return (
    <div className="mt-3" data-cy={`adaptive-readiness-${type}s`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-bold">
        <FontAwesomeIcon
          icon={type === 'error' ? faCircleExclamation : faTriangleExclamation}
          className={type === 'error' ? 'text-red-700' : 'text-orange-600'}
        />
        {title}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {issues.map((issue, index) => (
          <li
            key={`${issue.code}-${issue.path ?? index}`}
            className="border-uzh-grey-80 border-l-2 py-1 pl-2"
            data-cy={`adaptive-readiness-issue-${issue.code}`}
          >
            {formatAdaptiveReadinessIssue(asAdaptiveTranslator(t), issue)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AdaptiveReadinessPanel
