import { useLazyQuery, useQuery } from '@apollo/client'
import {
  Element,
  GetElementExportPackageLinkDocument,
  GetElementExportPackagePreviewDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H4,
  Modal,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { RefObject, useMemo, useState } from 'react'
import PackageAnswerCollectionOverview from './PackageAnswerCollectionOverview'
import SelectedElementsList from './batchOperations/SelectedElementsList'

type CachedDownloadPackage = {
  downloadLink: string
  filename: string
  expiresAt: string
}

async function createDownload(downloadLink: string, filename: string) {
  const response = await fetch(downloadLink)
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

function translateExportPackageMessage(t: any, code: string) {
  switch (code) {
    case 'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED':
      return t('manage.elements.elementImportExternalMediaWarning')
    case 'IMPORT_MEDIA_NOT_INCLUDED':
      return t('manage.elements.elementImportMediaMissingWarning')
    default:
      return code
  }
}

const DownloadSelectedElementsPackage: React.FC<{
  selectedElements: Element[]
  seenElementIds: RefObject<Record<string, CachedDownloadPackage>>
  onError: (message: string) => void
  disabled?: boolean
}> = ({ selectedElements, seenElementIds, onError, disabled = false }) => {
  const t = useTranslations()
  const [fetchDownloadLink, { loading }] = useLazyQuery(
    GetElementExportPackageLinkDocument
  )

  const selectedElementIds = selectedElements.map((element) => element.id)

  const handleDownload = async () => {
    try {
      onError('')
      const elementsIdentifier = [...selectedElements]
        .sort((a, b) => a.id - b.id)
        .map((element) => `${element.id}:${element.version}`)
        .join('-')

      const cachedPackage = seenElementIds.current[elementsIdentifier]
      const cachedPackageValid =
        cachedPackage &&
        new Date(cachedPackage.expiresAt).getTime() - Date.now() > 60_000
      const packageLink = cachedPackageValid
        ? cachedPackage
        : await fetchDownloadLink({
            variables: { elementIds: selectedElementIds },
            fetchPolicy: 'network-only',
          }).then((result) => result.data?.getElementExportPackageLink)

      if (!packageLink?.downloadLink) {
        throw new Error('No download link received.')
      }

      const downloadPackage = {
        downloadLink: packageLink.downloadLink,
        filename: packageLink.filename ?? 'klicker-elements.zip',
        expiresAt: packageLink.expiresAt ?? new Date(0).toISOString(),
      }

      seenElementIds.current[elementsIdentifier] = downloadPackage

      await createDownload(
        downloadPackage.downloadLink,
        downloadPackage.filename
      )
    } catch {
      const message = t('manage.elements.elementDownloadFailed')
      onError(message)
      toast({
        options: {
          description: message,
        },
        type: 'error',
      })
    }
  }

  const disableDownload = disabled || loading || selectedElementIds.length === 0
  return (
    <Button
      className={{ root: 'w-full sm:w-auto' }}
      onClick={handleDownload}
      disabled={disableDownload}
      data={{ cy: 'download-selected-elements-package' }}
    >
      {t('manage.elements.downloadElementsPackage')}
    </Button>
  )
}

function DownloadModal({
  selectedElements,
  seenElementIds,
  onClose,
}: {
  selectedElements: Element[]
  seenElementIds: RefObject<Record<string, CachedDownloadPackage>>
  onClose: () => void
}) {
  const t = useTranslations()
  const [downloadError, setDownloadError] = useState('')
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
  const exportPreviewError = exportPreviewQueryError?.message ?? ''
  const exportPreviewErrors = exportPreview?.errors ?? []
  const exportPreviewWarnings = exportPreview?.warnings ?? []
  const exportPreviewErrorMessage = exportPreviewError
    ? t('manage.elements.packageElementExportPermissionError')
    : exportPreviewErrors.includes('TOO_MANY_ELEMENTS')
      ? t('manage.elements.packageTooManyElementsError')
      : exportPreviewErrors.includes('ANSWER_COLLECTION_EXPORT_PERMISSION')
        ? t('manage.elements.packageAnswerCollectionExportPermissionError')
        : exportPreviewErrors.includes('ELEMENT_EXPORT_PERMISSION')
          ? t('manage.elements.packageElementExportPermissionError')
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
        content:
          'xl:w-220 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-auto',
      }}
      dataCloseButton={{ cy: 'close-element-download-modal' }}
    >
      <div className="flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-4">
        <UserNotification type="info" className={{ root: 'text-sm' }}>
          {t('manage.elements.exportElementsInfo')}
        </UserNotification>
        <UserNotification
          message={t('manage.elements.exportElementsPackageInfo')}
          className={{ root: 'text-sm' }}
        />
        <div className="flex min-h-0 flex-col gap-3">
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
                  .map((code: string) => translateExportPackageMessage(t, code))
                  .join(' ')}
                className={{ root: 'text-sm' }}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <DownloadSelectedElementsPackage
              selectedElements={selectedElements}
              seenElementIds={seenElementIds}
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
