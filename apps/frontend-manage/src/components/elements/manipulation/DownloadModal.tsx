import { useLazyQuery, useQuery } from '@apollo/client'
import {
  Element,
  GetElementExportPackageLinkDocument,
  GetElementExportPackagePreviewDocument,
  ImportExportErrorCode,
  ImportExportWarningCode,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H4,
  Modal,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getImportExportErrorCode,
  isRetryableElementExportPreviewError,
} from '~/lib/importExportErrors'
import PackageAnswerCollectionOverview from './PackageAnswerCollectionOverview'

type ElementsTranslator = ReturnType<typeof useTranslations<'manage.elements'>>

async function createDownload(
  downloadLink: string,
  filename: string,
  signal: AbortSignal
) {
  const response = await fetch(downloadLink, {
    credentials: 'include',
    signal,
  })
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')

  const blob = await response.blob()
  if (signal.aborted) return

  const blobUrl = URL.createObjectURL(blob)
  try {
    if (signal.aborted) return

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

function translateExportPackageWarning(
  t: ElementsTranslator,
  code: ImportExportWarningCode
) {
  switch (code) {
    case ImportExportWarningCode.ImportExternalMediaNotPackaged:
      return t('elementExportExternalMediaWarning')
    case ImportExportWarningCode.ImportMediaNotIncluded:
      return t('elementExportMediaMissingWarning')
    case ImportExportWarningCode.ImportStatusNormalizedToReview:
      return t('elementExportStatusNormalizedWarning')
    case ImportExportWarningCode.ImportUnusedMedia:
      return t('elementExportUnusedMediaWarning')
    case ImportExportWarningCode.ImportCleanupPending:
      return t('elementExportCleanupPendingWarning')
    default:
      return t('elementExportGenericWarning')
  }
}

function translateExportPackageError(
  t: ElementsTranslator,
  code: ImportExportErrorCode
) {
  switch (code) {
    case ImportExportErrorCode.ElementExportPermission:
      return t('packageElementExportPermissionError')
    case ImportExportErrorCode.AnswerCollectionExportPermission:
      return t('packageAnswerCollectionExportPermissionError')
    case ImportExportErrorCode.TooManyElements:
      return t('packageTooManyElementsError')
    case ImportExportErrorCode.ExportPackageTooLarge:
      return t('packageExportTooLargeError')
    case ImportExportErrorCode.ElementNotPortable:
      return t('packageElementNotPortableError')
    case ImportExportErrorCode.ExportAggregateLimit:
      return t('packageAggregateLimitError')
    case ImportExportErrorCode.ExportSourceChanged:
      return t('packageExportSourceChangedError')
    case ImportExportErrorCode.ImportExportRateLimited:
      return t('packageRateLimitedError')
    case ImportExportErrorCode.ImportArtifactQuotaExceeded:
      return t('packageArtifactQuotaError')
    case ImportExportErrorCode.ImportExportDisabled:
      return t('packageFeatureDisabledError')
    case ImportExportErrorCode.ImportExportRateLimitUnavailable:
    case ImportExportErrorCode.ImportExportInfrastructureFailure:
      return t('packageServiceUnavailableError')
    default:
      return t('packagePreviewError')
  }
}

const DownloadSelectedElementsPackage: React.FC<{
  selectedElements: Element[]
  onError: (message: string) => void
  disabled?: boolean
}> = ({ selectedElements, onError, disabled = false }) => {
  const t = useTranslations()
  const tElements = useTranslations('manage.elements')
  const [downloading, setDownloading] = useState(false)
  const downloadInProgressRef = useRef(false)
  const mountedRef = useRef(true)
  const activeDownloadControllerRef = useRef<AbortController | null>(null)
  const [fetchDownloadLink, { loading: loadingPackageLink }] = useLazyQuery(
    GetElementExportPackageLinkDocument
  )

  const selectedElementIds = selectedElements.map((element) => element.id)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      activeDownloadControllerRef.current?.abort()
      activeDownloadControllerRef.current = null
    }
  }, [])

  const handleDownload = async () => {
    if (downloadInProgressRef.current) return

    const controller = new AbortController()
    activeDownloadControllerRef.current = controller
    downloadInProgressRef.current = true
    setDownloading(true)
    try {
      onError('')
      const packageLink = await fetchDownloadLink({
        variables: { elementIds: selectedElementIds },
        fetchPolicy: 'network-only',
        context: { fetchOptions: { signal: controller.signal } },
      }).then((result) => result.data?.getElementExportPackageLink)

      if (controller.signal.aborted || !mountedRef.current) return

      if (!packageLink?.downloadLink) {
        throw new Error('No download link received.')
      }

      const downloadPackage = {
        downloadLink: packageLink.downloadLink,
        filename: packageLink.filename ?? 'klicker-elements.zip',
      }

      await createDownload(
        downloadPackage.downloadLink,
        downloadPackage.filename,
        controller.signal
      )
    } catch (error: unknown) {
      if (controller.signal.aborted || !mountedRef.current) return

      const code = getImportExportErrorCode(error)
      const message = code
        ? translateExportPackageError(tElements, code)
        : t('manage.elements.elementDownloadFailed')
      onError(message)
      toast({
        options: {
          description: message,
        },
        type: 'error',
      })
    } finally {
      if (activeDownloadControllerRef.current === controller) {
        activeDownloadControllerRef.current = null
      }
      downloadInProgressRef.current = false
      if (mountedRef.current) setDownloading(false)
    }
  }

  const downloadBusy = loadingPackageLink || downloading
  const disableDownload =
    disabled || downloadBusy || selectedElementIds.length === 0
  return (
    <div className="w-full sm:w-auto">
      <Button
        className={{ root: 'w-full sm:w-auto' }}
        onClick={handleDownload}
        disabled={disableDownload}
        loading={downloadBusy}
        aria-busy={downloadBusy}
        data={{ cy: 'download-selected-elements-package' }}
      >
        {t('manage.elements.downloadElementsPackage')}
      </Button>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        data-cy="element-export-download-status"
      >
        {downloadBusy ? t('manage.elements.packageDownloadPreparing') : ''}
      </span>
    </div>
  )
}

function DownloadModal({
  selectedElements,
  onClose,
}: {
  selectedElements: Element[]
  onClose: () => void
}) {
  const t = useTranslations()
  const tElements = useTranslations('manage.elements')
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    document
      .querySelector<HTMLElement>('[data-cy="close-element-download-modal"]')
      ?.focus()
  }, [])
  const selectedElementIds = useMemo(
    () => selectedElements.map((element) => element.id),
    [selectedElements]
  )
  const {
    data: exportPreviewData,
    loading: loadingExportPreview,
    error: exportPreviewQueryError,
    refetch: refetchExportPreview,
  } = useQuery(GetElementExportPackagePreviewDocument, {
    variables: { elementIds: selectedElementIds },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    skip: selectedElementIds.length === 0,
  })
  const exportPreview = exportPreviewData?.getElementExportPackagePreview
  const exportPreviewErrors = exportPreview?.errors ?? []
  const exportPreviewWarnings = exportPreview?.warnings ?? []
  const missingExportPreview =
    selectedElementIds.length > 0 &&
    !loadingExportPreview &&
    !exportPreviewQueryError &&
    !exportPreview
  const exportPreviewQueryErrorCode = getImportExportErrorCode(
    exportPreviewQueryError
  )
  const exportPreviewErrorCode = exportPreviewQueryError
    ? exportPreviewQueryErrorCode
    : (exportPreviewErrors[0] ??
      (missingExportPreview
        ? ImportExportErrorCode.ImportExportInfrastructureFailure
        : null))
  const exportPreviewErrorMessage = exportPreviewQueryError
    ? exportPreviewQueryErrorCode
      ? translateExportPackageError(tElements, exportPreviewQueryErrorCode)
      : t('manage.elements.packagePreviewError')
    : exportPreviewErrors[0]
      ? translateExportPackageError(tElements, exportPreviewErrors[0])
      : missingExportPreview
        ? t('manage.elements.packageServiceUnavailableError')
        : ''
  const exportBlocked =
    !exportPreview ||
    Boolean(exportPreviewQueryError) ||
    exportPreviewErrors.length > 0
  const retryableExportPreviewError =
    Boolean(exportPreviewErrorMessage) &&
    isRetryableElementExportPreviewError({
      code: exportPreviewErrorCode,
      unknownNetworkError: Boolean(
        exportPreviewQueryError?.networkError && !exportPreviewQueryErrorCode
      ),
    })

  const retryExportPreview = () => {
    setDownloadError('')
    void refetchExportPreview().catch(() => undefined)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.elements.exportElements')}
      className={{
        overlay:
          'data-[state=closed]:animate-none! data-[state=open]:animate-none!',
        content:
          'xl:w-220 data-[state=closed]:animate-none! data-[state=open]:animate-none! max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-auto overscroll-contain',
      }}
      dataCloseButton={{ cy: 'close-element-download-modal' }}
      dataContent={{ cy: 'element-download-modal' }}
    >
      <div className="flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-4">
        <UserNotification type="info" className={{ root: 'text-sm' }}>
          {t('manage.elements.exportElementsInfo')}
        </UserNotification>
        <UserNotification
          message={t('manage.elements.exportElementsPackageInfo')}
          className={{ root: 'text-sm' }}
        />
        <UserNotification
          message={t('manage.elements.elementExportPsychometricDisclosure')}
          className={{ root: 'text-sm' }}
        />
        <UserNotification
          type="warning"
          message={t(
            'manage.elements.elementExportCopyrightSolutionsDisclosure'
          )}
          className={{
            root: 'text-sm',
            icon: 'text-red-900',
            message: 'text-red-900',
          }}
        />
        <div
          className="flex min-h-0 flex-col gap-3"
          aria-busy={loadingExportPreview}
        >
          <H4>{t('shared.generic.elements')}</H4>
          <div className="text-sm">
            {t('manage.questionPool.selectedElementsDescriptionDownload', {
              numElements: selectedElements.length,
            })}
          </div>
          <ul
            className="max-h-48 list-disc overflow-auto pl-6"
            aria-label={t('shared.generic.elements')}
          >
            {selectedElements.map((element) => (
              <li key={element.id}>{element.name}</li>
            ))}
          </ul>
          <PackageAnswerCollectionOverview
            mode="export"
            collections={exportPreview?.answerCollections ?? []}
            loading={loadingExportPreview}
            error={exportPreviewErrorMessage}
            onRetry={
              retryableExportPreviewError ? retryExportPreview : undefined
            }
            dataCy="element-export-answer-collections-overview"
          />
          {downloadError ? (
            <div
              role="alert"
              aria-atomic="true"
              data-cy="element-export-package-error"
            >
              <UserNotification
                type="error"
                message={downloadError}
                className={{ root: 'text-sm' }}
              />
            </div>
          ) : null}
          {exportPreviewWarnings.length > 0 ? (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-cy="element-export-package-warning"
            >
              <UserNotification
                type="warning"
                message={exportPreviewWarnings
                  .map((code) => translateExportPackageWarning(tElements, code))
                  .join(' ')}
                className={{
                  root: 'text-sm',
                  icon: 'text-red-900',
                  message: 'text-red-900',
                }}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <DownloadSelectedElementsPackage
              selectedElements={selectedElements}
              onError={setDownloadError}
              disabled={loadingExportPreview || exportBlocked}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default DownloadModal
