import { useLazyQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import {
  GetCourseLearningAnalyticsExportV2Document,
  LearningAnalyticsExportFormatV2,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function LearningAnalyticsExportV2({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const [exportFailed, setExportFailed] = useState(false)
  const [loadCsv, { loading: csvLoading }] = useLazyQuery(
    GetCourseLearningAnalyticsExportV2Document,
    { fetchPolicy: 'network-only' }
  )
  const [loadJson, { loading: jsonLoading }] = useLazyQuery(
    GetCourseLearningAnalyticsExportV2Document,
    { fetchPolicy: 'network-only' }
  )
  const loading = csvLoading || jsonLoading

  async function download(format: LearningAnalyticsExportFormatV2) {
    setExportFailed(false)

    try {
      const result = await (format === LearningAnalyticsExportFormatV2.Csv
        ? loadCsv({ variables: { courseId, format } })
        : loadJson({ variables: { courseId, format } }))
      const exported = result.data?.getCourseLearningAnalyticsExportV2
      if (!exported) throw new Error('Learning analytics export unavailable')

      const url = URL.createObjectURL(
        new Blob([exported.content], { type: exported.mimeType })
      )
      const link = document.createElement('a')
      link.href = url
      link.download = exported.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportFailed(true)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loading}
          loading={csvLoading}
          aria-busy={csvLoading}
          onClick={() => void download(LearningAnalyticsExportFormatV2.Csv)}
          data={{ cy: 'analytics-export-csv' }}
        >
          <Button.Icon icon={faDownload} loading={csvLoading} />
          <Button.Label>{t('manage.analytics.exportCsvV2')}</Button.Label>
        </Button>
        <Button
          disabled={loading}
          loading={jsonLoading}
          aria-busy={jsonLoading}
          onClick={() => void download(LearningAnalyticsExportFormatV2.Json)}
          data={{ cy: 'analytics-export-json' }}
        >
          <Button.Icon icon={faDownload} loading={jsonLoading} />
          <Button.Label>{t('manage.analytics.exportJsonV2')}</Button.Label>
        </Button>
      </div>
      {exportFailed ? (
        <div data-cy="analytics-export-error" aria-live="polite">
          <UserNotification
            type="error"
            message={t('manage.analytics.exportFailedV2')}
          />
        </div>
      ) : null}
    </div>
  )
}

export default LearningAnalyticsExportV2
