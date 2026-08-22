'use client'

import { Button, Modal } from '@uzh-bf/design-system'
import { LoaderCircleIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { useDictationContext } from './dictation-context'

export function DictationSheet() {
  const t = useTranslations()
  const {
    closeInstallSheet,
    installDictation,
    installSheetOpen,
    refreshCapability,
    startDictation,
    state: dictationState,
    status,
  } = useDictationContext()

  // The design-system `Modal` hardcodes `onOpenAutoFocus` prevention (see
  // `DisclaimerModal`), so focus must be moved into the dialog here or it
  // stays on the obscured composer control behind the overlay.
  const primaryActionRef = useRef<HTMLButtonElement>(null)

  // A successful install returns the composer to the user immediately; the
  // sheet must not stay open over an input it would otherwise block.
  useEffect(() => {
    if (status === 'ready') closeInstallSheet()
  }, [closeInstallSheet, status])

  useEffect(() => {
    if (!installSheetOpen) return
    primaryActionRef.current?.focus()
  }, [installSheetOpen])

  if (!installSheetOpen) return null

  const isInstalling = status === 'installing'
  const isReady = status === 'ready'
  const isError = status === 'error'
  const isInstallError = isError && dictationState.error === 'install-failed'
  const isAvailabilityError =
    isError && dictationState.error === 'availability-check-failed'

  return (
    <Modal
      data={{ cy: 'chat-dictation-sheet' }}
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

        {isError ? (
          <p
            className="text-destructive text-sm"
            role="alert"
            data-cy="chat-dictation-install-error"
          >
            {isAvailabilityError
              ? t('chat.composer.dictationErrorAvailabilityCheck')
              : t('chat.composer.dictationSheetFailed')}
          </p>
        ) : null}

        {isReady ? (
          <>
            <p className="text-sm">{t('chat.composer.dictationSheetReady')}</p>
            <div className="flex justify-end">
              <Button
                primary
                ref={primaryActionRef}
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
              ref={primaryActionRef}
              data-cy="chat-dictation-download"
              onClick={() => {
                if (isInstallError || status === 'needs-install') {
                  void installDictation()
                } else {
                  void refreshCapability()
                }
              }}
              disabled={isInstalling}
            >
              {isInstallError
                ? t('chat.composer.dictationSheetRetry')
                : isAvailabilityError
                  ? t('chat.composer.dictationSheetCheckAgain')
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
