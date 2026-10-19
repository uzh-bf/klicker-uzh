'use client'

import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react'
import { Button, Modal } from '@uzh-bf/design-system'
import { LoaderCircleIcon, MicIcon, SquareIcon } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import type { DictationErrorCode } from '../lib/speech/onDeviceDictation'
import { useDictationContext } from './dictation-context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const ERROR_MESSAGE_KEYS = {
  aborted: 'chat.composer.dictationErrorAborted',
  'audio-capture': 'chat.composer.dictationErrorAudioCapture',
  'install-failed': 'chat.composer.dictationErrorInstall',
  'language-not-supported': 'chat.composer.dictationErrorLanguageNotSupported',
  network: 'chat.composer.dictationErrorNetwork',
  'no-speech': 'chat.composer.dictationErrorNoSpeech',
  'not-allowed': 'chat.composer.dictationErrorNotAllowed',
  'service-not-allowed': 'chat.composer.dictationErrorServiceNotAllowed',
  unknown: 'chat.composer.dictationErrorUnknown',
} as const satisfies Record<DictationErrorCode, string>

/** The localized message for the last dictation failure, if any. */
export function useDictationErrorMessage(): string | null {
  const t = useTranslations()
  const { error } = useDictationContext()
  return error ? t(ERROR_MESSAGE_KEYS[error]) : null
}

const buttonClassName =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md touch-manipulation focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50'

export function DictationButton() {
  const t = useTranslations()
  const aui = useAui()
  const { threadId } = useParams<{ threadId?: string }>()
  const { availability, setInstallSheetOpen } = useDictationContext()
  const listening = useAuiState((s) => s.composer.dictation != null)

  // The composer outlives a thread switch; end the session so speech meant
  // for one thread does not keep arriving in the next.
  useEffect(() => {
    return () => aui.composer.stopDictation()
  }, [aui, threadId])

  if (listening) {
    const label = t('chat.composer.dictationListening')
    return (
      <ComposerPrimitive.StopDictation asChild>
        <button
          type="button"
          data-cy="chat-dictation-stop"
          aria-label={t('chat.composer.dictationStop')}
          className={twMerge(
            buttonClassName,
            'text-destructive hover:text-destructive bg-destructive/10 min-h-11 px-3 text-sm fine-pointer:min-h-9'
          )}
        >
          <span
            aria-hidden="true"
            className="bg-destructive size-2 animate-pulse rounded-full motion-reduce:animate-none"
          />
          <span aria-live="polite">{label}</span>
          <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
        </button>
      </ComposerPrimitive.StopDictation>
    )
  }

  if (availability === 'ready') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <ComposerPrimitive.Dictate asChild>
            <button
              type="button"
              data-cy="chat-dictation"
              aria-label={t('chat.composer.dictation')}
              className={twMerge(
                buttonClassName,
                'size-11 fine-pointer:size-9'
              )}
            >
              <MicIcon aria-hidden="true" className="size-5" />
            </button>
          </ComposerPrimitive.Dictate>
        </TooltipTrigger>
        <TooltipContent>{t('chat.composer.dictation')}</TooltipContent>
      </Tooltip>
    )
  }

  if (availability === 'needs-install' || availability === 'installing') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-cy="chat-dictation"
            aria-label={t('chat.composer.dictationSetup')}
            className={twMerge(buttonClassName, 'size-11 fine-pointer:size-9')}
            onClick={() => setInstallSheetOpen(true)}
          >
            <MicIcon aria-hidden="true" className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('chat.composer.dictationSetup')}</TooltipContent>
      </Tooltip>
    )
  }

  return null
}

export function DictationSheet() {
  const t = useTranslations()
  const aui = useAui()
  const {
    availability,
    error,
    install,
    installSheetOpen,
    refresh,
    setInstallSheetOpen,
  } = useDictationContext()
  // The design-system `Modal` prevents `onOpenAutoFocus` (see
  // `DisclaimerModal`), so focus must be moved into the dialog here or it
  // stays on the obscured composer control behind the overlay.
  const primaryActionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (installSheetOpen) primaryActionRef.current?.focus()
  }, [installSheetOpen, availability])

  if (!installSheetOpen) return null

  const close = () => setInstallSheetOpen(false)
  const installing = availability === 'installing'

  return (
    <Modal
      dataContent={{ cy: 'chat-dictation-sheet' }}
      title={t('chat.composer.dictationSheetTitle')}
      open
      onClose={close}
      hideCloseButton
    >
      <div className="space-y-4">
        <p className="text-sm">{t('chat.composer.dictationSheetBody')}</p>
        <p className="text-muted-foreground text-xs">
          {t('chat.composer.dictationLanguageHint')}
        </p>

        {installing ? (
          <div
            className="text-muted-foreground flex items-center gap-2 text-sm"
            aria-live="polite"
            data-cy="chat-dictation-installing"
          >
            <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
            <span>{t('chat.composer.dictationSheetInstalling')}</span>
          </div>
        ) : null}

        {error === 'install-failed' ? (
          <p
            className="text-destructive text-sm"
            role="alert"
            data-cy="chat-dictation-install-error"
          >
            {t('chat.composer.dictationSheetFailed')}
          </p>
        ) : null}

        {availability === 'ready' ? (
          <>
            <p className="text-sm">{t('chat.composer.dictationSheetReady')}</p>
            <div className="flex justify-end">
              <Button
                primary
                ref={primaryActionRef}
                data-cy="chat-dictation-start"
                onClick={() => {
                  close()
                  aui.composer.startDictation()
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
              disabled={installing}
              onClick={() =>
                void (availability === 'needs-install' ? install() : refresh())
              }
            >
              {error === 'install-failed'
                ? t('chat.composer.dictationSheetRetry')
                : availability === 'needs-install'
                  ? t('chat.composer.dictationSheetDownload')
                  : t('chat.composer.dictationSheetCheckAgain')}
            </Button>
            <Button data-cy="chat-dictation-not-now" onClick={close}>
              {t('chat.composer.dictationSheetNotNow')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
