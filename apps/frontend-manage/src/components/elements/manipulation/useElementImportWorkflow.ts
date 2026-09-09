import { useMutation } from '@apollo/client'
import {
  ImportElementPackageDocument,
  ImportExportErrorCode,
  ImportExportWarningCode,
  PrepareElementImportPackageUploadDocument,
  ValidateElementImportPackageDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { ErrorCode, type FileRejection } from 'react-dropzone'
import { createElementImportReviewModel } from '~/lib/elementImportPreview'
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

function reviewFromState(state: ElementImportWorkflowState) {
  return state.phase === 'reviewing' || state.phase === 'importing'
    ? state.review
    : null
}

function fileNameFromState(state: ElementImportWorkflowState) {
  return 'fileName' in state ? state.fileName : null
}

export function useElementImportWorkflow({
  onClose,
  refetchElements,
}: {
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const router = useRouter()
  const t = useTranslations()
  const te = useTranslations('manage.elements')
  const [workflowState, dispatch] = useReducer(
    elementImportWorkflowReducer,
    initialElementImportWorkflowState
  )
  const workflowStateRef = useRef(workflowState)
  const requestGenerationRef = useRef(0)
  const activeUploadControllerRef = useRef<AbortController | null>(null)

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
              .querySelector<HTMLElement>(
                '[data-cy="element-import-review-disclosures"]'
              )
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
      const isImportPending = () => {
        const state: ElementImportWorkflowState = workflowStateRef.current
        return (
          requestGenerationRef.current === generation &&
          state.generation === generation &&
          state.phase === 'importing'
        )
      }
      const isRefreshPending = () => {
        const state: ElementImportWorkflowState = workflowStateRef.current
        return (
          requestGenerationRef.current === generation &&
          state.generation === generation &&
          state.phase === 'success' &&
          state.refreshStatus === 'refreshing'
        )
      }
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
        if (!isImportPending()) return

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

      if (!isImportPending()) return
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
        if (!isRefreshPending()) return
        invalidatePendingWork()
        onClose()
      } catch {
        if (!isRefreshPending()) return
        dispatchWorkflow({ type: 'REFRESH_FAILED' })
        toast({
          type: 'warning',
          message: t('manage.elements.elementImportRefreshFailed'),
          options: { duration: 7000 },
        })
      }
    },
    [
      dispatchWorkflow,
      importElementPackage,
      invalidatePendingWork,
      onClose,
      refetchElements,
      t,
      te,
    ]
  )

  const handleClose = useCallback(() => {
    if (workflowStateRef.current.phase === 'importing') {
      return
    }
    invalidatePendingWork()
    onClose()
  }, [invalidatePendingWork, onClose])

  const review = reviewFromState(workflowState)
  const uploadedFileName = fileNameFromState(workflowState)
  const workflowBusy = isElementImportWorkflowBusy(workflowState)
  const importing = workflowState.phase === 'importing'

  useEffect(() => {
    if (!importing) return

    const currentHistoryState = window.history.state
    const currentUrl = window.location.href
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handlePopState = () => {
      // popstate has already moved the browser history pointer. Restore the
      // exact current Next.js entry before declining the router transition.
      window.history.pushState(currentHistoryState, '', currentUrl)
      return false
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    router.beforePopState(handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      router.beforePopState(() => true)
    }
  }, [importing, router])

  const refreshing =
    workflowState.phase === 'success' &&
    workflowState.refreshStatus === 'refreshing'
  const processing = workflowBusy || refreshing
  const nonDismissible = importing
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

  return {
    handleClose,
    handleFileRejection,
    handleFileUpload,
    handleImport,
    importing,
    nonDismissible,
    packageWarnings,
    processing,
    review,
    uploadedFileName,
    workflowBusy,
    workflowState,
    workflowStatus,
  }
}
