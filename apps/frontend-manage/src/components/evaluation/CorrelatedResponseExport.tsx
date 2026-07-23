import { useLazyQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { GetCorrelatedLiveQuizResponseExportDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CorrelatedResponseExport({ liveQuizId }: { liveQuizId: string }) {
  const t = useTranslations()
  const [getExport, { loading }] = useLazyQuery(
    GetCorrelatedLiveQuizResponseExportDocument
  )

  const downloadExport = async () => {
    try {
      const result = await getExport({ variables: { id: liveQuizId } })
      const responseExport = result.data?.correlatedLiveQuizResponseExport
      if (!responseExport) {
        throw new Error(result.error?.message ?? 'Export unavailable')
      }

      const blob = new Blob([responseExport.content], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = responseExport.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast({
        type: 'error',
        message: message.includes('LIVE_QUIZ_CORRELATED_EXPORT_EMPTY')
          ? t('manage.evaluation.responseExportEmpty')
          : message.includes('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
            ? t('manage.evaluation.responseExportTooLarge')
            : t('manage.evaluation.responseExportFailed'),
      })
    }
  }

  return (
    <div className="flex flex-col items-start justify-end gap-2 border-b bg-gray-50 px-3 py-2 sm:flex-row sm:items-center print:hidden">
      <p className="max-w-3xl text-sm leading-5 text-gray-700">
        {t('manage.evaluation.responseExportPrivacyWarning')}
      </p>
      <Button
        onClick={downloadExport}
        disabled={loading}
        loading={loading}
        className={{ root: 'min-h-8 shrink-0 py-1' }}
        data={{ cy: 'download-correlated-live-quiz-responses' }}
      >
        <Button.Icon icon={faDownload} />
        <Button.Label>
          {t('manage.evaluation.downloadCorrelatedResponses')}
        </Button.Label>
      </Button>
    </div>
  )
}

export default CorrelatedResponseExport
