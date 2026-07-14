import { useMutation } from '@apollo/client'
import {
  ImportElementPackageDocument,
  ImportExportErrorCode,
  ImportExportWarningCode,
  PrepareElementImportPackageUploadDocument,
  ValidateElementImportPackageDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import { H4, Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { ErrorCode, type FileRejection } from 'react-dropzone'
import {
  createElementImportReviewModel,
  type ElementImportReviewModel,
} from '~/lib/elementImportPreview'
import {
  elementImportWorkflowReducer,
  initialElementImportWorkflowState,
  isElementImportWorkflowBusy,
  type ElementImportWorkflowAction,
  type ElementImportWorkflowState,
} from '~/lib/elementImportWorkflow'
import {
  getImportExportErrorCode,
  getImportExportRouteErrorCode,
} from '~/lib/importExportErrors'
import { MediaUploadDropzone } from '../../common/MediaLibrary'
import ImportedElementsOverviewTable from '../details/ImportedElementsOverviewTable'

type ElementsTranslator = ReturnType<typeof useTranslations<'manage.elements'>>

function formatPackageSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

class SafeUploadError extends Error {
  constructor(readonly userMessage: string) {
    super('Element package upload failed.')
    this.name = 'SafeUploadError'
  }
}

function translatePackageWarning(
  t: ElementsTranslator,
  code: ImportExportWarningCode
) {
  switch (code) {
    case ImportExportWarningCode.ImportStatusNormalizedToReview:
      return t('elementImportStatusNormalizedWarning')
    case ImportExportWarningCode.ImportExternalMediaNotPackaged:
      return t('elementImportExternalMediaWarning')
    case ImportExportWarningCode.ImportMediaNotIncluded:
      return t('elementImportMediaMissingWarning')
    case ImportExportWarningCode.ImportUnusedMedia:
      return t('elementImportUnusedMediaWarning')
    case ImportExportWarningCode.ImportCleanupPending:
      return t('elementImportCleanupPendingWarning')
    default:
      return t('elementImportGenericWarning')
  }
}

function translatePackageError(
  t: ElementsTranslator,
  code: ImportExportErrorCode
) {
  switch (code) {
    case ImportExportErrorCode.ImportInvalidOptions:
      return t('elementImportInvalidOptions')
    case ImportExportErrorCode.ImportManifestNotAtRoot:
      return t('elementImportManifestNotAtRoot')
    case ImportExportErrorCode.ImportPackageTooLarge:
    case ImportExportErrorCode.ImportUploadTooLarge:
      return t('elementImportFileTooLarge', {
        size: formatPackageSize(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES),
      })
    case ImportExportErrorCode.ImportAggregateLimit:
      return t('elementImportAggregateLimit')
    case ImportExportErrorCode.ImportArtifactQuotaExceeded:
      return t('elementImportArtifactQuotaExceeded')
    case ImportExportErrorCode.ImportPackageNotFound:
    case ImportExportErrorCode.ImportPackageExpired:
    case ImportExportErrorCode.ImportTokenExpired:
    case ImportExportErrorCode.ImportTokenInvalid:
      return t('elementImportPackageNotFound')
    case ImportExportErrorCode.ImportReplayMismatch:
    case ImportExportErrorCode.ImportPackageChanged:
      return t('elementImportSelectionInvalid')
    case ImportExportErrorCode.ImportInvalidPackage:
    case ImportExportErrorCode.ImportUnsupportedFileType:
    case ImportExportErrorCode.ImportUnsafeReference:
      return t('elementImportInvalidFile')
    case ImportExportErrorCode.ImportUnsupportedPackage:
      return t('elementImportUnsupportedPackage')
    case ImportExportErrorCode.ImportInvalidSelection:
      return t('elementImportSelectionInvalid')
    case ImportExportErrorCode.ImportInProgress:
      return t('elementImportInProgress')
    case ImportExportErrorCode.ImportExportRateLimited:
      return t('elementImportRateLimited')
    case ImportExportErrorCode.ImportExportDisabled:
      return t('packageFeatureDisabledError')
    case ImportExportErrorCode.ImportExportRateLimitUnavailable:
    case ImportExportErrorCode.ImportExportInfrastructureFailure:
      return t('elementImportServiceUnavailable')
    default:
      return t('elementImportUploadFailed')
  }
}

function translateImportCommitError(
  t: ElementsTranslator,
  code: ImportExportErrorCode
) {
  switch (code) {
    case ImportExportErrorCode.ImportInvalidOptions:
      return t('elementImportInvalidOptions')
    case ImportExportErrorCode.ImportInvalidSelection:
      return t('elementImportSelectionInvalid')
    case ImportExportErrorCode.ImportInProgress:
      return t('elementImportInProgress')
    case ImportExportErrorCode.ImportExportRateLimited:
      return t('elementImportRateLimited')
    case ImportExportErrorCode.ImportExportDisabled:
      return t('packageFeatureDisabledError')
    case ImportExportErrorCode.ImportExportRateLimitUnavailable:
    case ImportExportErrorCode.ImportExportInfrastructureFailure:
      return t('elementImportServiceUnavailable')
    case ImportExportErrorCode.ImportPackageNotFound:
    case ImportExportErrorCode.ImportPackageExpired:
    case ImportExportErrorCode.ImportTokenInvalid:
    case ImportExportErrorCode.ImportTokenExpired:
      return t('elementImportPackageNotFound')
    case ImportExportErrorCode.ImportReplayMismatch:
    case ImportExportErrorCode.ImportPackageChanged:
      return t('elementImportSelectionInvalid')
    default:
      return t('elementImportError')
  }
}

function reviewFromState(
  state: ElementImportWorkflowState
): ElementImportReviewModel | null {
  return state.phase === 'reviewing' || state.phase === 'importing'
    ? state.review
    : null
}

function fileNameFromState(state: ElementImportWorkflowState) {
  return 'fileName' in state ? state.fileName : null
}

function UploadModal({
  onClose,
  refetchElements,
}: {
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const te = useTranslations('manage.elements')
  const [workflowState, dispatch] = useReducer(
    elementImportWorkflowReducer,
    initialElementImportWorkflowState
  )
  const workflowStateRef = useRef(workflowState)
  const requestGenerationRef = useRef(0)
  const activeUploadControllerRef = useRef<AbortController | null>(null)
  const completionStatusRef = useRef<HTMLDivElement | null>(null)

  const [preparePackageUpload] = useMutation(
    PrepareElementImportPackageUploadDocument
  )
  const [validatePackageUpload] = useMutation(
    ValidateElementImportPackageDocument,
    { fetchPolicy: 'no-cache' }
  )
  const [importElementPackage] = useMutation(ImportElementPackageDocument)

  const dispatchWorkflow = useCallback(
    (action: ElementImportWorkflowAction) => {
      workflowStateRef.current = elementImportWorkflowReducer(
        workflowStateRef.current,
        action
      )
      dispatch(action)
    },
    []
  )

  const beginRequestGeneration = useCallback(() => {
    activeUploadControllerRef.current?.abort()
    activeUploadControllerRef.current = null
    requestGenerationRef.current += 1
    return requestGenerationRef.current
  }, [])

  const invalidatePendingWork = useCallback(() => {
    requestGenerationRef.current += 1
    activeUploadControllerRef.current?.abort()
    activeUploadControllerRef.current = null
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          '[data-cy="element-upload-modal"] [data-cy="element-import-dropzone"]'
        )
        ?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      invalidatePendingWork()
    }
  }, [invalidatePendingWork])

  useEffect(() => {
    if (
      workflowState.phase === 'success' &&
      workflowState.refreshStatus === 'failed'
    ) {
      completionStatusRef.current?.focus()
    }
  }, [workflowState])

  const showUploadError = useCallback(
    (generation: number, message: string) => {
      dispatchWorkflow({ type: 'UPLOAD_FAILED', generation, message })
      toast({
        type: 'error',
        message,
        options: { duration: 5000 },
      })
    },
    [dispatchWorkflow]
  )

  const handleFileRejection = useCallback(
    (fileRejections: FileRejection[]) => {
      const currentState = workflowStateRef.current
      if (
        isElementImportWorkflowBusy(currentState) ||
        currentState.phase === 'success'
      ) {
        return
      }

      const generation = beginRequestGeneration()
      const isTooLarge = fileRejections.some((rejection) =>
        rejection.errors.some((error) => error.code === ErrorCode.FileTooLarge)
      )
      const message = isTooLarge
        ? t('manage.elements.elementImportFileTooLarge', {
            size: formatPackageSize(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES),
          })
        : t('manage.elements.elementImportInvalidFile')

      dispatchWorkflow({ type: 'FILE_REJECTED', generation, message })
      toast({
        type: 'error',
        message,
        options: { duration: 5000 },
      })
    },
    [beginRequestGeneration, dispatchWorkflow, t]
  )

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      const currentState = workflowStateRef.current
      if (
        isElementImportWorkflowBusy(currentState) ||
        currentState.phase === 'success'
      ) {
        return
      }

      const file = files[0]
      if (!file) return

      const generation = beginRequestGeneration()
      const controller = new AbortController()
      activeUploadControllerRef.current = controller
      const isCurrentRequest = () =>
        requestGenerationRef.current === generation &&
        activeUploadControllerRef.current === controller &&
        !controller.signal.aborted

      dispatchWorkflow({
        type: 'START_UPLOAD',
        generation,
        fileName: file.name,
      })

      try {
        if (!file.name.toLowerCase().endsWith('.zip')) {
          throw new SafeUploadError(
            t('manage.elements.elementImportInvalidFile')
          )
        }
        if (file.size > ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES) {
          throw new SafeUploadError(
            t('manage.elements.elementImportFileTooLarge', {
              size: formatPackageSize(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES),
            })
          )
        }

        const uploadResult = await preparePackageUpload({
          variables: { filename: file.name, bytes: file.size },
          context: { fetchOptions: { signal: controller.signal } },
        })
        if (!isCurrentRequest()) return

        const upload =
          uploadResult.data?.prepareElementImportPackageUpload ?? null
        if (!upload) {
          throw new SafeUploadError(
            t('manage.elements.elementImportInvalidFile')
          )
        }

        const response = await fetch(upload.uploadURL, {
          method: 'PUT',
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/zip',
            'x-klicker-import-upload-capability': upload.uploadCapability,
          },
          body: file,
        })
        if (!isCurrentRequest()) return

        if (!response.ok) {
          const code = getImportExportRouteErrorCode(
            await response.json().catch(() => null)
          )
          throw new SafeUploadError(
            code
              ? translatePackageError(te, code)
              : t('manage.elements.elementImportUploadFailed')
          )
        }

        dispatchWorkflow({ type: 'START_VALIDATION', generation })
        const validationResult = await validatePackageUpload({
          variables: { artifactId: upload.artifactId },
          context: { fetchOptions: { signal: controller.signal } },
        })
        if (!isCurrentRequest()) return

        const preview =
          validationResult.data?.validateElementImportPackage ?? null
        if (!preview) {
          throw new SafeUploadError(
            t('manage.elements.elementImportInvalidFile')
          )
        }
        if (preview.errors.length > 0 || !preview.importToken) {
          const errorMessages = preview.errors.map((code) =>
            translatePackageError(te, code)
          )
          throw new SafeUploadError(
            errorMessages.join(' ') ||
              t('manage.elements.elementImportInvalidFile')
          )
        }
        if (preview.elements.length === 0) {
          throw new SafeUploadError(
            t('manage.elements.elementImportInvalidFile')
          )
        }

        const review = createElementImportReviewModel({
          ...preview,
          importToken: preview.importToken,
        })
        dispatchWorkflow({ type: 'REVIEW_READY', generation, review })

        window.requestAnimationFrame(() => {
          if (
            requestGenerationRef.current === generation &&
            workflowStateRef.current.phase === 'reviewing'
          ) {
            document
              .querySelector<HTMLElement>('[data-cy="element-0-import"]')
              ?.focus()
          }
        })
        toast({
          type: 'success',
          message: t('manage.elements.elementImportValidationSuccess', {
            number: preview.elements.length,
          }),
          options: { duration: 3000 },
        })
      } catch (error: unknown) {
        if (!isCurrentRequest()) return

        const code = getImportExportErrorCode(error)
        const message =
          error instanceof SafeUploadError
            ? error.userMessage
            : code
              ? translatePackageError(te, code)
              : t('manage.elements.elementImportUploadFailed')
        showUploadError(generation, message)
      } finally {
        if (activeUploadControllerRef.current === controller) {
          activeUploadControllerRef.current = null
        }
      }
    },
    [
      beginRequestGeneration,
      dispatchWorkflow,
      preparePackageUpload,
      showUploadError,
      t,
      te,
      validatePackageUpload,
    ]
  )

  const handleImport = useCallback(
    async (selectedElementRefs: string[]) => {
      const currentState = workflowStateRef.current
      if (
        currentState.phase !== 'reviewing' ||
        selectedElementRefs.length === 0
      ) {
        return
      }

      const generation = currentState.generation
      const importToken = currentState.review.importToken
      dispatchWorkflow({ type: 'START_IMPORT' })

      let importedElements: number
      let cleanupPending: boolean
      try {
        const result = await importElementPackage({
          variables: { importToken, selectedElementRefs },
        })
        const importResult = result.data?.importElementPackage
        if (!importResult) {
          throw new Error('Element import returned no result.')
        }

        importedElements = importResult.importedElements
        cleanupPending = importResult.warnings.includes(
          ImportExportWarningCode.ImportCleanupPending
        )
      } catch (error: unknown) {
        if (
          workflowStateRef.current.phase !== 'importing' ||
          workflowStateRef.current.generation !== generation
        ) {
          return
        }

        const code = getImportExportErrorCode(error)
        const message = code
          ? translateImportCommitError(te, code)
          : t('manage.elements.elementImportError')
        dispatchWorkflow({ type: 'IMPORT_FAILED', message })
        toast({
          type: 'error',
          message,
          options: { duration: 5000 },
        })
        return
      }

      if (
        workflowStateRef.current.phase !== 'importing' ||
        workflowStateRef.current.generation !== generation
      ) {
        return
      }
      dispatchWorkflow({
        type: 'IMPORT_COMMITTED',
        importedElements,
        cleanupPending,
      })
      toast({
        type: 'success',
        message: t('manage.elements.elementImportSuccess', {
          number: importedElements,
        }),
        options: { duration: 3500 },
      })
      if (cleanupPending) {
        toast({
          type: 'warning',
          message: t('manage.elements.elementImportCleanupPendingWarning'),
          options: { duration: 7000 },
        })
      }

      try {
        await refetchElements()
        onClose()
      } catch {
        dispatchWorkflow({ type: 'REFRESH_FAILED' })
        toast({
          type: 'warning',
          message: t('manage.elements.elementImportRefreshFailed'),
          options: { duration: 7000 },
        })
      }
    },
    [dispatchWorkflow, importElementPackage, onClose, refetchElements, t, te]
  )

  const handleClose = useCallback(() => {
    if (
      workflowStateRef.current.phase === 'importing' ||
      (workflowStateRef.current.phase === 'success' &&
        workflowStateRef.current.refreshStatus === 'refreshing')
    ) {
      return
    }
    invalidatePendingWork()
    onClose()
  }, [invalidatePendingWork, onClose])

  const review = reviewFromState(workflowState)
  const uploadedFileName = fileNameFromState(workflowState)
  const workflowBusy = isElementImportWorkflowBusy(workflowState)
  const importing = workflowState.phase === 'importing'
  const refreshing =
    workflowState.phase === 'success' &&
    workflowState.refreshStatus === 'refreshing'
  const processing = workflowBusy || refreshing
  const nonDismissible = importing || refreshing
  const packageWarnings =
    review?.warnings.map((code) => translatePackageWarning(te, code)) ?? []

  const workflowStatus = (() => {
    switch (workflowState.phase) {
      case 'uploading':
        return t('manage.elements.elementImportStatusUploading')
      case 'validating':
        return t('manage.elements.elementImportStatusValidating')
      case 'reviewing':
        return t('manage.elements.elementImportStatusReviewing')
      case 'importing':
        return t('manage.elements.elementImportStatusImporting')
      case 'success':
        return workflowState.refreshStatus === 'refreshing'
          ? `${t('manage.elements.elementImportSuccess', {
              number: workflowState.importedElements,
            })} ${t('manage.elements.elementImportStatusRefreshing')}`
          : `${t('manage.elements.elementImportSuccess', {
              number: workflowState.importedElements,
            })} ${t('manage.elements.elementImportRefreshFailed')}`
      case 'error':
        return workflowState.message
      case 'idle':
        return t('manage.elements.elementImportEmptyState')
    }
  })()

  const renderUploadDropzone = ({
    compact = false,
  }: { compact?: boolean } = {}): ReactNode => (
    <MediaUploadDropzone
      accept={{
        'application/zip': ['.zip'],
        'application/x-zip-compressed': ['.zip'],
      }}
      title={t('manage.elements.uploadElementsFile')}
      description={
        <>
          <p>{t('manage.elements.uploadElementsZipDescription')}</p>
          {uploadedFileName ? (
            <div
              className="mt-2 break-all text-xs text-slate-600"
              data-cy="element-import-file-name"
            >
              {uploadedFileName}
            </div>
          ) : null}
        </>
      }
      activeDescription={t('manage.elements.dropElementsZip')}
      compact={compact}
      isUploading={workflowBusy}
      maxSize={ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES}
      inputAriaLabel={t('manage.elements.uploadElementsFile')}
      onDropAccepted={handleFileUpload}
      onDropRejected={handleFileRejection}
      data={{ cy: 'element-import-dropzone' }}
      className={{
        root: compact
          ? 'h-10 rounded-md border border-solid bg-white px-3 text-sm'
          : 'min-h-40 rounded-md border border-solid bg-white px-4 py-6 text-sm',
        title: compact ? 'w-full truncate text-center' : undefined,
        description: 'text-slate-600',
      }}
    />
  )

  const completion = workflowState.phase === 'success' ? workflowState : null

  return (
    <Modal
      open
      onClose={handleClose}
      title={t('manage.elements.importElements')}
      className={{
        overlay:
          'data-[state=closed]:animate-none! data-[state=open]:animate-none!',
        content:
          'xl:w-300 data-[state=closed]:animate-none! data-[state=open]:animate-none! max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-hidden overscroll-contain',
      }}
      escapeDisabled={nonDismissible}
      hideCloseButton={nonDismissible}
      secondaryLabel={
        nonDismissible
          ? undefined
          : completion
            ? t('shared.generic.close')
            : t('shared.generic.cancel')
      }
      onSecondaryAction={nonDismissible ? undefined : handleClose}
      dataCloseButton={
        nonDismissible ? undefined : { cy: 'close-element-upload-modal' }
      }
      dataSecondaryAction={
        nonDismissible ? undefined : { cy: 'cancel-element-upload-modal' }
      }
      dataContent={{ cy: 'element-upload-modal' }}
    >
      <div
        className="flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-4"
        aria-busy={processing}
        data-cy="element-import-workflow"
      >
        <p
          className={
            processing || workflowState.phase === 'error'
              ? 'm-0 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800'
              : 'sr-only'
          }
          role="status"
          aria-live="polite"
          aria-atomic
          data-cy="element-import-status"
        >
          {workflowStatus}
        </p>
        <UserNotification type="info" className={{ root: 'text-sm' }}>
          {t('manage.elements.importElementsInfo')}
        </UserNotification>

        {review ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <H4>{t('manage.elements.reviewElementsBeforeImport')}</H4>
                {uploadedFileName ? (
                  <div
                    className="mt-1 truncate text-sm text-slate-600"
                    data-cy="element-import-file-name"
                  >
                    {uploadedFileName}
                  </div>
                ) : null}
              </div>
              <div className="w-full sm:w-56">
                {renderUploadDropzone({ compact: true })}
              </div>
            </div>

            {packageWarnings.length > 0 ? (
              <div data-cy="element-import-package-warning">
                <UserNotification
                  type="warning"
                  message={packageWarnings.join(' ')}
                  className={{
                    root: 'text-sm',
                    icon: 'text-red-900',
                    message: 'text-red-900',
                  }}
                />
              </div>
            ) : null}

            <ImportedElementsOverviewTable
              elements={review.elements}
              elementMeta={review.elementMeta}
              answerCollectionEntries={review.answerCollectionEntries}
              answerCollectionsForOverview={review.answerCollections}
              importing={importing}
              commitError={
                workflowState.phase === 'reviewing'
                  ? workflowState.commitError
                  : null
              }
              onImport={handleImport}
            />
          </div>
        ) : completion ? (
          <div
            ref={completionStatusRef}
            className="flex min-h-48 flex-col justify-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            tabIndex={-1}
            role="status"
            aria-live="polite"
            data-cy="element-import-completion"
          >
            <UserNotification
              type="success"
              message={t('manage.elements.elementImportSuccess', {
                number: completion.importedElements,
              })}
              className={{ root: 'text-sm' }}
            />
            {completion.refreshStatus === 'refreshing' ? (
              <UserNotification
                message={t('manage.elements.elementImportStatusRefreshing')}
                className={{ root: 'text-sm' }}
              />
            ) : (
              <div data-cy="element-import-refresh-failed">
                <UserNotification
                  type="warning"
                  message={t('manage.elements.elementImportRefreshFailed')}
                  className={{
                    root: 'text-sm',
                    icon: 'text-red-900',
                    message: 'text-red-900',
                  }}
                />
              </div>
            )}
            {completion.cleanupPending ? (
              <UserNotification
                type="warning"
                message={t(
                  'manage.elements.elementImportCleanupPendingWarning'
                )}
                className={{ root: 'text-sm' }}
              />
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-auto">
              <H4>{t('manage.elements.uploadElementsFile')}</H4>
              {renderUploadDropzone()}
              {workflowState.phase === 'error' ? (
                <div data-cy="element-import-package-error">
                  <UserNotification
                    type="error"
                    message={workflowState.message}
                    className={{ root: 'text-sm' }}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <H4>{t('manage.elements.reviewElementsBeforeImport')}</H4>
              <UserNotification
                message={t('manage.elements.elementImportEmptyState')}
                className={{ root: 'text-sm' }}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default UploadModal
