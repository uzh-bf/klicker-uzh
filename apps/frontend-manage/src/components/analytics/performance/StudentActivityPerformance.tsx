import { useLazyQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import {
  GetLearningAnalyticsExportDocument,
  ParticipantActivityPerformances,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import { Button, Checkbox, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function StudentActivityPerformance({
  courseId,
  effectiveN,
  performances,
}: {
  courseId: string
  effectiveN: number | null
  performances: ParticipantActivityPerformances[]
}) {
  const t = useTranslations()
  const [includePartial, setIncludePartial] = useState(false)
  const [exportSuppressed, setExportSuppressed] = useState(false)
  const [loadExport, { loading: exportLoading }] = useLazyQuery(
    GetLearningAnalyticsExportDocument,
    { fetchPolicy: 'no-cache' }
  )

  const handleExport = async () => {
    setExportSuppressed(false)
    const result = await loadExport({
      variables: { courseId, includePartial },
    })
    const exportData = result.data?.getLearningAnalyticsExport
    if (!exportData) {
      setExportSuppressed(true)
      return
    }

    const url = URL.createObjectURL(
      new Blob([exportData.content], { type: exportData.mimeType })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = exportData.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <H2 className={{ root: 'mb-0' }}>
          {t('manage.analytics.studentActivityPerformance')}
        </H2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-partial-learning-analytics"
              checked={includePartial}
              onCheck={() => setIncludePartial((value) => !value)}
            />
            <label
              htmlFor="include-partial-learning-analytics"
              className="text-sm"
            >
              {t('manage.analytics.includePartialCoverage')}
            </label>
          </div>
          <Button
            disabled={exportLoading}
            onClick={handleExport}
            data={{ cy: 'learning-analytics-export' }}
          >
            <Button.Icon icon={faDownload} />
            <Button.Label>
              {t('manage.analytics.exportLearningAnalytics')}
            </Button.Label>
          </Button>
        </div>
      </div>

      {effectiveN !== null && performances.length > 0 ? (
        <>
          <UserNotification className={{ root: 'mb-3' }}>
            {t('manage.analytics.deidentifiedPerformanceDescription', {
              effectiveN,
            })}
          </UserNotification>
          <DataTable
            isPaginated
            isResetSortingEnabled
            columns={[
              {
                accessorKey: 'studentLabel',
                header: t('manage.analytics.studentLabel'),
                displayName: t('manage.analytics.studentLabel'),
              },
              {
                accessorKey: 'coverage',
                header: t('manage.analytics.coverage'),
                displayName: t('manage.analytics.coverage'),
                cell: ({ row }: any) =>
                  row.original.coverage === 'COMPLETE'
                    ? t('manage.analytics.completeCoverage')
                    : t('manage.analytics.partialCoverage'),
              },
              {
                accessorKey: 'completedActivities',
                header: t('manage.analytics.completedActivities'),
                displayName: t('manage.analytics.completedActivities'),
              },
              {
                accessorKey: 'meanCompletion',
                header: t('manage.analytics.meanCompletion'),
                displayName: t('manage.analytics.meanCompletion'),
                cell: ({ row }: any) =>
                  `${Math.round(row.original.meanCompletion * 100)} %`,
              },
            ]}
            data={performances}
            className={{
              table: 'overflow-x-auto',
              tableHeader: 'h-7 p-2',
              tableCell: 'h-7 p-2',
            }}
          />
        </>
      ) : (
        <UserNotification
          type="info"
          message={t('manage.analytics.learningAnalyticsSuppressed')}
        />
      )}

      {exportSuppressed ? (
        <UserNotification
          className={{ root: 'mt-3' }}
          type="info"
          message={t('manage.analytics.exportSuppressed')}
        />
      ) : null}
    </div>
  )
}

export default StudentActivityPerformance
