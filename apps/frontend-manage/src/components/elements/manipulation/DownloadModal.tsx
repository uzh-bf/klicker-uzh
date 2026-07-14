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
import { getImportExportErrorCode } from '~/lib/importExportErrors'
import PackageAnswerCollectionOverview from './PackageAnswerCollectionOverview'
import SelectedElementsList from './batchOperations/SelectedElementsList'

async function createDownload(downloadLink: string, filename: string) {
  const response = await fetch(downloadLink, { credentials: 'include' })
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

function translateExportPackageWarning(t: any, code: ImportExportWarningCode) {
  switch (code) {
    case ImportExportWarningCode.ImportExternalMediaNotPackaged:
      return t('manage.elements.elementImportExternalMediaWarning')
    case ImportExportWarningCode.ImportMediaNotIncluded:
      return t('manage.elements.elementImportMediaMissingWarning')
    case ImportExportWarningCode.ImportStatusNormalizedToReview:
      return t('manage.elements.elementImportStatusNormalizedWarning')
    case ImportExportWarningCode.ImportUnusedMedia:
      return t('manage.elements.elementImportUnusedMediaWarning')
    case ImportExportWarningCode.ImportCleanupPending:
      return t('manage.elements.elementImportCleanupPendingWarning')
    default:
      return t('manage.elements.elementImportGenericWarning')
  }
}

function translateExportPackageError(t: any, code: ImportExportErrorCode) {
  switch (code) {
    case ImportExportErrorCode.ElementExportPermission:
      return t('manage.elements.packageElementExportPermissionError')
    case ImportExportErrorCode.AnswerCollectionExportPermission:
      return t('manage.elements.packageAnswerCollectionExportPermissionError')
    case ImportExportErrorCode.TooManyElements:
      return t('manage.elements.packageTooManyElementsError')
    case ImportExportErrorCode.ExportPackageTooLarge:
      return t('manage.elements.packageExportTooLargeError')
    case ImportExportErrorCode.ElementNotPortable:
      return t('manage.elements.packageElementNotPortableError')
    case ImportExportErrorCode.ExportAggregateLimit:
      return t('manage.elements.packageAggregateLimitError')
    case ImportExportErrorCode.ExportSourceChanged:
      return t('manage.elements.packageExportSourceChangedError')
    case ImportExportErrorCode.ImportExportRateLimited:
      return t('manage.elements.packageRateLimitedError')
    case ImportExportErrorCode.ImportArtifactQuotaExceeded:
      return t('manage.elements.packageArtifactQuotaError')
    case ImportExportErrorCode.ImportExportDisabled:
      return t('manage.elements.packageFeatureDisabledError')
    case ImportExportErrorCode.ImportExportRateLimitUnavailable:
    case ImportExportErrorCode.ImportExportInfrastructureFailure:
      return t('manage.elements.packageServiceUnavailableError')
    default:
      return t('manage.elements.packagePreviewError')
  }
}

const DownloadSelectedElementsPackage: React.FC<{
  selectedElements: Element[]
  onError: (message: string) => void
  disabled?: boolean
}> = ({ selectedElements, onError, disabled = false }) => {
  const t = useTranslations()
  const [downloading, setDownloading] = useState(false)
  const downloadInProgressRef = useRef(false)
  const [fetchDownloadLink, { loading: loadingPackageLink }] = useLazyQuery(
    GetElementExportPackageLinkDocument
  )

  const selectedElementIds = selectedElements.map((element) => element.id)

  const handleDownload = async () => {
    if (downloadInProgressRef.current) return

    downloadInProgressRef.current = true
    setDownloading(true)
    try {
      onError('')
      const packageLink = await fetchDownloadLink({
        variables: { elementIds: selectedElementIds },
        fetchPolicy: 'network-only',
      }).then((result) => result.data?.getElementExportPackageLink)

      if (!packageLink?.downloadLink) {
        throw new Error('No download link received.')
      }

      const downloadPackage = {
        downloadLink: packageLink.downloadLink,
        filename: packageLink.filename ?? 'klicker-elements.zip',
      }

      await createDownload(
        downloadPackage.downloadLink,
        downloadPackage.filename
      )
    } catch (error: unknown) {
      const code = getImportExportErrorCode(error)
      const message = code
        ? translateExportPackageError(t, code)
        : t('manage.elements.elementDownloadFailed')
      onError(message)
      toast({
        options: {
          description: message,
        },
        type: 'error',
      })
    } finally {
      downloadInProgressRef.current = false
      setDownloading(false)
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
  } = useQuery(GetElementExportPackagePreviewDocument, {
    variables: { elementIds: selectedElementIds },
    fetchPolicy: 'network-only',
    skip: selectedElementIds.length === 0,
  })
  const exportPreview = exportPreviewData?.getElementExportPackagePreview
  const exportPreviewErrors = exportPreview?.errors ?? []
  const exportPreviewWarnings = exportPreview?.warnings ?? []
  const exportPreviewQueryErrorCode = getImportExportErrorCode(
    exportPreviewQueryError
  )
  const exportPreviewErrorMessage = exportPreviewQueryError
    ? exportPreviewQueryErrorCode
      ? translateExportPackageError(t, exportPreviewQueryErrorCode)
      : t('manage.elements.packagePreviewError')
    : exportPreviewErrors[0]
      ? translateExportPackageError(t, exportPreviewErrors[0])
      : ''
  const shownExportError = downloadError || exportPreviewErrorMessage
  const exportBlocked =
    Boolean(exportPreviewQueryError) || exportPreviewErrors.length > 0

  const affectedElements = selectedElements.map((element) => ({
    ...element,
    actionsApplied: true,
    reasons: [] as string[],
  }))

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
          {loadingExportPreview ? (
            <div
              className="sr-only"
              role="status"
              aria-live="polite"
              data-cy="element-export-preview-status"
            >
              {t('manage.elements.packagePreviewLoading')}
            </div>
          ) : null}
          <H4>{t('shared.generic.elements')}</H4>
          <div className="text-sm">
            {t('manage.questionPool.selectedElementsDescriptionDownload', {
              numElements: selectedElements.length,
            })}
          </div>
          <SelectedElementsList
            selectedElements={selectedElements}
            affectedElements={affectedElements}
          />
          <PackageAnswerCollectionOverview
            mode="export"
            collections={exportPreview?.answerCollections ?? []}
            loading={loadingExportPreview}
            error={exportPreviewErrorMessage}
            dataCy="element-export-answer-collections-overview"
          />
          {shownExportError && (
            <div data-cy="element-export-package-error">
              <UserNotification
                type="error"
                message={shownExportError}
                className={{ root: 'text-sm' }}
              />
            </div>
          )}
          {exportPreviewWarnings.length > 0 ? (
            <div data-cy="element-export-package-warning">
              <UserNotification
                type="warning"
                message={exportPreviewWarnings
                  .map((code) => translateExportPackageWarning(t, code))
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
