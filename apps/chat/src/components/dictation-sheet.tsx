'use client'

import { Button, Modal } from '@uzh-bf/design-system'
import { LoaderCircleIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useDictationContext } from './dictation-context'

export function DictationSheet() {
  const t = useTranslations()
  const {
    closeInstallSheet,
    installDictation,
    installSheetOpen,
    startDictation,
    status,
  } = useDictationContext()

  if (!installSheetOpen) return null

  const isInstalling = status === 'installing'
  const isReady = status === 'ready'
  const isInstallError = status === 'error'

  return (
    <Modal
      data-cy="chat-dictation-sheet"
      title={t('chat.composer.dictationSheetTitle')}
      open
      onClose={closeInstallSheet}
      hideCloseButton
    >
      <div className="space-y-4">
        <p className="text-sm">{t('chat.composer.dictationSheetBody')}</p>

        {isInstalling ? (
          <div
            className="text-muted-foreground flex items-center gap-2 text-sm"
            aria-live="polite"
            data-cy="chat-dictation-installing"
          >
            <LoaderCircleIcon className="size-4 animate-spin" />
            <span>{t('chat.composer.dictationSheetInstalling')}</span>
          </div>
        ) : null}

        {isInstallError ? (
          <p
            className="text-destructive text-sm"
            role="alert"
            data-cy="chat-dictation-install-error"
          >
            {t('chat.composer.dictationSheetFailed')}
          </p>
        ) : null}

        {isReady ? (
          <>
            <p className="text-sm">{t('chat.composer.dictationSheetReady')}</p>
            <div className="flex justify-end">
              <Button
                primary
                data-cy="chat-dictation-start"
                onClick={() => {
                  if (startDictation()) closeInstallSheet()
                }}
              >
                {t('chat.composer.dictationSheetStart')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              data-cy="chat-dictation-download"
              onClick={() => void installDictation()}
              disabled={isInstalling}
            >
              {isInstallError
                ? t('chat.composer.dictationSheetRetry')
                : t('chat.composer.dictationSheetDownload')}
            </Button>
            <Button
              data-cy="chat-dictation-not-now"
              onClick={closeInstallSheet}
              disabled={isInstalling}
            >
              {t('chat.composer.dictationSheetNotNow')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
