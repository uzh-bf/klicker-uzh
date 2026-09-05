import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  ElementImportCompletionView,
  ElementImportReviewView,
  ElementImportUploadView,
} from './ElementImportWorkflowViews'
import { useElementImportWorkflow } from './useElementImportWorkflow'

function UploadModal({
  onClose,
  refetchElements,
}: {
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const {
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
  } = useElementImportWorkflow({ onClose, refetchElements })
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
          <ElementImportReviewView
            review={review}
            fileName={uploadedFileName}
            packageWarnings={packageWarnings}
            workflowBusy={workflowBusy}
            importing={importing}
            commitError={
              workflowState.phase === 'reviewing'
                ? workflowState.commitError
                : null
            }
            onDropAccepted={handleFileUpload}
            onDropRejected={handleFileRejection}
            onImport={handleImport}
          />
        ) : completion ? (
          <ElementImportCompletionView completion={completion} />
        ) : (
          <ElementImportUploadView
            fileName={uploadedFileName}
            workflowBusy={workflowBusy}
            errorMessage={
              workflowState.phase === 'error' ? workflowState.message : null
            }
            onDropAccepted={handleFileUpload}
            onDropRejected={handleFileRejection}
          />
        )}
      </div>
    </Modal>
  )
}

export default UploadModal
