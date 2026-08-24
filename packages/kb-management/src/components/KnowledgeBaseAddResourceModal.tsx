import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import KnowledgeBaseFileDropzone from './KnowledgeBaseFileDropzone'
import KnowledgeBaseUrlForm from './KnowledgeBaseUrlForm'

type AddResourceMode = 'chooser' | 'website' | 'document'

function KnowledgeBaseAddResourceModal({
  kbId,
  onClose,
  onResourceCreated,
}: {
  kbId: string
  onClose: () => void
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [mode, setMode] = useState<AddResourceMode>('chooser')

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
    onClose()
  }

  const isChooser = mode === 'chooser'

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isChooser
          ? t('kb.addResourceTitle')
          : mode === 'website'
            ? t('kb.addWebsite')
            : t('kb.addDocument')
      }
      secondaryLabel={
        isChooser ? t('shared.generic.close') : t('kb.backToResourceTypes')
      }
      onSecondaryAction={() => {
        if (isChooser) onClose()
        else setMode('chooser')
      }}
      dataContent={{ cy: 'kb-add-resource-modal' }}
      dataCloseButton={{ cy: 'close-kb-add-resource-modal' }}
      dataSecondaryAction={{ cy: 'back-kb-add-resource' }}
      className={{ content: 'max-w-3xl' }}
    >
      {isChooser ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('kb.addResourceDescription')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              onClick={() => setMode('website')}
              data={{ cy: 'choose-kb-resource-website' }}
              className={{
                root: 'h-auto min-h-24 w-full justify-start px-4 py-3 text-left',
              }}
            >
              <Button.Label>
                <span className="block font-semibold">
                  {t('kb.addWebsite')}
                </span>
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
                <span className="block font-semibold">
                  {t('kb.addDocument')}
                </span>
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
          onResourceCreated={handleResourceCreated}
        />
      )}
    </Modal>
  )
}

export default KnowledgeBaseAddResourceModal
