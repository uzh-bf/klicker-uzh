import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import { H4, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import type { FileRejection } from 'react-dropzone'
import type { ElementImportReviewModel } from '~/lib/elementImportPreview'
import type { ElementImportWorkflowState } from '~/lib/elementImportWorkflow'
import FileUploadDropzone from '../../common/FileUploadDropzone'
import ImportedElementsOverviewTable from '../details/ImportedElementsOverviewTable'

type CompletionState = Extract<ElementImportWorkflowState, { phase: 'success' }>

function ElementImportDropzone({
  compact = false,
  fileName,
  isUploading,
  onDropAccepted,
  onDropRejected,
}: {
  compact?: boolean
  fileName: string | null
  isUploading: boolean
  onDropAccepted: (files: File[]) => Promise<void>
  onDropRejected: (fileRejections: FileRejection[]) => void
}) {
  const t = useTranslations()

  return (
    <FileUploadDropzone
      accept={{
        'application/zip': ['.zip'],
        'application/x-zip-compressed': ['.zip'],
      }}
      title={t('manage.elements.uploadElementsFile')}
      description={
        <>
          <p>{t('manage.elements.uploadElementsZipDescription')}</p>
          {fileName ? (
            <div
              className="mt-2 break-all text-xs text-slate-600"
              data-cy="element-import-file-name"
            >
              {fileName}
            </div>
          ) : null}
        </>
      }
      activeDescription={t('manage.elements.dropElementsZip')}
      compact={compact}
      isUploading={isUploading}
      maxSize={ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES}
      inputAriaLabel={t('manage.elements.uploadElementsFile')}
      onDropAccepted={onDropAccepted}
      onDropRejected={onDropRejected}
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
}

export function ElementImportReviewView({
  review,
  fileName,
  packageWarnings,
  workflowBusy,
  importing,
  commitError,
  onDropAccepted,
  onDropRejected,
  onImport,
}: {
  review: ElementImportReviewModel
  fileName: string | null
  packageWarnings: string[]
  workflowBusy: boolean
  importing: boolean
  commitError: string | null
  onDropAccepted: (files: File[]) => Promise<void>
  onDropRejected: (fileRejections: FileRejection[]) => void
  onImport: (selectedElementRefs: string[]) => Promise<void>
}) {
  const t = useTranslations()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <H4>{t('manage.elements.reviewElementsBeforeImport')}</H4>
          {fileName ? (
            <div
              className="mt-1 truncate text-sm text-slate-600"
              data-cy="element-import-file-name"
            >
              {fileName}
            </div>
          ) : null}
        </div>
        <div className="w-full sm:w-56">
          <ElementImportDropzone
            compact
            fileName={fileName}
            isUploading={workflowBusy}
            onDropAccepted={onDropAccepted}
            onDropRejected={onDropRejected}
          />
        </div>
      </div>

      {packageWarnings.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-cy="element-import-package-warning"
        >
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
        commitError={commitError}
        onImport={onImport}
      />
    </div>
  )
}

export function ElementImportCompletionView({
  completion,
}: {
  completion: CompletionState
}) {
  const t = useTranslations()
  const completionStatusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (completion.refreshStatus === 'failed') {
      completionStatusRef.current?.focus()
    }
  }, [completion.refreshStatus])

  return (
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
          message={t('manage.elements.elementImportCleanupPendingWarning')}
          className={{ root: 'text-sm' }}
        />
      ) : null}
    </div>
  )
}

export function ElementImportUploadView({
  fileName,
  workflowBusy,
  errorMessage,
  onDropAccepted,
  onDropRejected,
}: {
  fileName: string | null
  workflowBusy: boolean
  errorMessage: string | null
  onDropAccepted: (files: File[]) => Promise<void>
  onDropRejected: (fileRejections: FileRejection[]) => void
}) {
  const t = useTranslations()

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
      <div className="flex min-h-0 flex-col gap-3 overflow-auto">
        <H4>{t('manage.elements.uploadElementsFile')}</H4>
        <ElementImportDropzone
          fileName={fileName}
          isUploading={workflowBusy}
          onDropAccepted={onDropAccepted}
          onDropRejected={onDropRejected}
        />
        {errorMessage ? (
          <div data-cy="element-import-package-error">
            <UserNotification
              type="error"
              message={errorMessage}
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
  )
}
