import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import KnowledgeBaseFileDropzone from './KnowledgeBaseFileDropzone'

function KnowledgeBaseReplaceFileModal({
  kbId,
  resource,
  onClose,
  onResourceCreated,
}: {
  kbId: string
  resource: { id: string; title: string }
  onClose: () => void
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)

  const handleClose = () => {
    if (uploading) return
    onClose()
  }

  const handleResourceCreated = async () => {
    await onResourceCreated()
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      escapeDisabled={uploading}
      hideCloseButton={uploading}
      title={t('kb.replaceFileTitle')}
      dataContent={{ cy: 'kb-replace-file-modal' }}
      dataCloseButton={{ cy: 'close-kb-replace-file' }}
      className={{ content: 'max-w-3xl' }}
    >
      <div className="mt-2">
        <KnowledgeBaseFileDropzone
          kbId={kbId}
          embedded
          replaceResource={resource}
          onUploadStateChange={setUploading}
          onResourceCreated={handleResourceCreated}
        />
      </div>
    </Modal>
  )
}

export default KnowledgeBaseReplaceFileModal
