import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import KnowledgeBaseFileDropzone from './KnowledgeBaseFileDropzone'
import KnowledgeBaseUrlForm from './KnowledgeBaseUrlForm'

type AddResourceMode = 'chooser' | 'website' | 'document'

function KnowledgeBaseAddResourceModal({
  kbId,
  triggerRef,
  onClose,
  onResourceCreated,
}: {
  kbId: string
  triggerRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [mode, setMode] = useState<AddResourceMode>('chooser')
  const [uploadingDocument, setUploadingDocument] = useState(false)

  const closeModal = () => {
    onClose()
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleClose = () => {
    if (uploadingDocument) return
    closeModal()
  }

  useEffect(() => {
    const modal = document.querySelector<HTMLElement>(
      '[data-cy="kb-add-resource-modal"]'
    )
    if (!modal) return

    modal.setAttribute('aria-describedby', 'kb-add-resource-description')

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusableElements.length === 0) return

      const firstElement = focusableElements.at(0)
      const lastElement = focusableElements.at(-1)
      if (!firstElement || !lastElement) return
      const activeElement = document.activeElement

      if (!modal.contains(activeElement)) {
        event.preventDefault()
        const targetElement = event.shiftKey ? lastElement : firstElement
        targetElement.focus()
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [mode])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const selector =
        mode === 'chooser'
          ? '[data-cy="choose-kb-resource-website"]'
          : mode === 'website'
            ? '[data-cy="kb-url-title"]'
            : '[data-cy="kb-file-dropzone"]'
      document.querySelector<HTMLElement>(selector)?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [mode])

  const handleResourceCreated = async () => {
    await onResourceCreated()
    closeModal()
  }

  const isChooser = mode === 'chooser'

  return (
    <Modal
      open
      onClose={handleClose}
      escapeDisabled={uploadingDocument}
      hideCloseButton={uploadingDocument}
      title={
        isChooser
          ? t('kb.addResourceTitle')
          : mode === 'website'
            ? t('kb.addWebsite')
            : t('kb.addDocument')
      }
      secondaryLabel={isChooser ? undefined : t('kb.backToResourceTypes')}
      onSecondaryAction={isChooser ? undefined : () => setMode('chooser')}
      dataContent={{ cy: 'kb-add-resource-modal' }}
      dataCloseButton={{ cy: 'close-kb-add-resource-modal' }}
      dataSecondaryAction={{ cy: 'back-kb-add-resource' }}
      className={{ content: 'max-w-3xl' }}
    >
      <p
        id="kb-add-resource-description"
        className={isChooser ? 'text-sm text-slate-600' : 'sr-only'}
      >
        {t('kb.addResourceDescription')}
      </p>
      {isChooser ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Button
            onClick={() => setMode('website')}
            data={{ cy: 'choose-kb-resource-website' }}
            className={{
              root: 'h-auto min-h-24 w-full justify-start px-4 py-3 text-left',
            }}
          >
            <Button.Label>
              <span className="block font-semibold">{t('kb.addWebsite')}</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                {t('kb.addWebsiteDescription')}
              </span>
            </Button.Label>
          </Button>
          <Button
            onClick={() => setMode('document')}
            data={{ cy: 'choose-kb-resource-document' }}
            className={{
              root: 'h-auto min-h-24 w-full justify-start px-4 py-3 text-left',
            }}
          >
            <Button.Label>
              <span className="block font-semibold">{t('kb.addDocument')}</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                {t('kb.addDocumentDescription')}
              </span>
            </Button.Label>
          </Button>
          <Button
            disabled
            aria-disabled="true"
            data={{ cy: 'choose-kb-resource-video' }}
            className={{
              root: 'h-auto min-h-24 w-full justify-start px-4 py-3 text-left',
            }}
          >
            <Button.Label>
              <span className="block font-semibold">{t('kb.addVideo')}</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                {t('kb.comingSoon')}
              </span>
            </Button.Label>
          </Button>
        </div>
      ) : mode === 'website' ? (
        <KnowledgeBaseUrlForm
          kbId={kbId}
          embedded
          onResourceCreated={handleResourceCreated}
        />
      ) : (
        <KnowledgeBaseFileDropzone
          kbId={kbId}
          embedded
          onUploadStateChange={setUploadingDocument}
          onResourceCreated={handleResourceCreated}
        />
      )}
    </Modal>
  )
}

export default KnowledgeBaseAddResourceModal
