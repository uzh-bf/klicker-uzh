import type { QAdaptivePracticeQuizAttemptDiagnosticsQuery } from '@klicker-uzh/graphql/dist/ops'
import { Label } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { confidencePercent } from '../dryRuns/adaptiveDryRunTypes'

type AttemptVersion = NonNullable<
  QAdaptivePracticeQuizAttemptDiagnosticsQuery['adaptivePracticeQuizAttemptDiagnostics']
>['versions'][number]

const KEY = 'manage.evaluation.adaptive.attemptDiagnostics.versions'

// Which algorithm version the completed attempts ran on, and when: the
// publication (its frozen stop settings), the engine build and the estimator.
function AdaptiveAttemptVersions({ versions }: { versions: AttemptVersion[] }) {
  const t = useTranslations()
  const formatter = useFormatter()
  if (versions.length === 0) return null
  const date = (value: string) =>
    formatter.dateTime(new Date(value), {
      dateStyle: 'short',
      timeStyle: 'short',
    })

  return (
    <div className="my-4" data-cy="adaptive-attempt-versions">
      <Label
        label={t(`${KEY}.title`)}
        tooltip={t(`${KEY}.tooltip`)}
        showTooltipSymbol
        tooltipSymbolSize="sm"
        className={{
          root: 'mb-1 text-sm font-semibold',
          tooltip: 'max-w-96 text-sm font-normal',
        }}
      />
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-700">
            <tr>
              <th className="px-3 py-2">{t(`${KEY}.publication`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.settings`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.engine`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.estimator`)}</th>
              <th className="px-3 py-2 text-right">{t(`${KEY}.attempts`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.period`)}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version, index) => (
              <tr
                // Groups differ by fields not all shown here, so the position
                // keeps keys unique.
                key={`${index}-${version.publicationVersion}-${version.engineRevision}-${version.measurementVersion}`}
                className="border-t border-gray-100 align-top"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="font-medium">
                    {version.publicationVersion == null
                      ? t(`${KEY}.unknown`)
                      : t(`${KEY}.publicationVersion`, {
                          version: version.publicationVersion,
                        })}
                  </span>
                  {version.current ? (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                      {t(`${KEY}.current`)}
                    </span>
                  ) : null}
                  {version.publishedAt ? (
                    <div className="text-xs text-gray-500">
                      {t(`${KEY}.publishedAt`, {
                        date: date(version.publishedAt),
                      })}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {version.totalQuestionCap == null ||
                  version.classificationZ == null
                    ? '–'
                    : t('manage.evaluation.adaptive.dryRuns.result.settings', {
                        cap: version.totalQuestionCap,
                        precision: String(
                          version.classificationToleranceBands ?? 0
                        ),
                        reachedFrom: Math.round(
                          (version.levelReachedFrom ?? 0) * 100
                        ),
                        confidence:
                          confidencePercent(version.classificationZ) ??
                          `z ${version.classificationZ}`,
                        minPerLeaf: version.minQuestionsPerLeaf ?? 0,
                      })}
                </td>
                <td
                  className="px-3 py-2 font-mono text-xs"
                  title={version.engineRevision ?? undefined}
                >
                  {version.engineRevision ?? (
                    <span className="font-sans text-gray-500">
                      {t(`${KEY}.notRecorded`)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {version.estimatorImplementationVersion ??
                    version.measurementVersion}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {version.attemptCount}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {version.firstStartedAt === version.lastStartedAt
                    ? date(version.firstStartedAt)
                    : `${date(version.firstStartedAt)} – ${date(version.lastStartedAt)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdaptiveAttemptVersions
