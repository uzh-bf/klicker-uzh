import { useLazyQuery } from '@apollo/client'
import { GetCorrelatedLiveQuizResponseExportDocument } from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

// the correlated CSV is fetched through an authorized GraphQL operation and
// turned into a browser download here; the typed export errors stay the
// fallback for the race between an eligible quiz and a fully settled dataset.
function useCorrelatedResponseExport(liveQuizId: string) {
  const t = useTranslations()
  const [getExport, { loading }] = useLazyQuery(
    GetCorrelatedLiveQuizResponseExportDocument,
    { fetchPolicy: 'no-cache' }
  )

  const downloadExport = useCallback(async () => {
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
          : message.includes('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY')
            ? t('manage.evaluation.responseExportNotReady')
            : message.includes('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
              ? t('manage.evaluation.responseExportTooLarge')
              : t('manage.evaluation.responseExportFailed'),
      })
    }
  }, [getExport, liveQuizId, t])

  return { downloadExport, loading }
}

export default useCorrelatedResponseExport
