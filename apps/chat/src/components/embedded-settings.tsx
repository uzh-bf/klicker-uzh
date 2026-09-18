'use client'

import { ChevronDown, Plus, X, Zap } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { twMerge } from 'tailwind-merge'
import { isKnownMode } from '../lib/config/modes'
import { useEmbedded } from '../hooks/useEmbedded'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatUi } from './chat-ui-context'

// Host contract for closing the embedded conversation from inside the chat.
const EMBEDDED_CLOSE_MESSAGE_TYPE = 'klicker:chat-close'

/**
 * Whether the embedded mode select has anything to offer. Shared by the bar
 * that decides whether it has any content at all and by the select itself, so
 * the two can never disagree about the empty state.
 */
export function hasEmbeddedModeSettings(
  showMinimalSettings: boolean,
  modeOptions: Record<string, string>
) {
  return showMinimalSettings && Object.keys(modeOptions).length > 1
}

export function EmbeddedSettings() {
  const t = useTranslations()
  const { showMinimalSettings } = useChatUi()
  const { selectedMode, modeOptions, setSelectedMode } = useSettingsStore()

  if (!hasEmbeddedModeSettings(showMinimalSettings, modeOptions)) return null
  const modeKeys = Object.keys(modeOptions)

  return (
    <div className="relative ml-auto min-w-0 max-w-[10rem] shrink sm:max-w-[12rem]">
      <select
        value={selectedMode}
        onChange={(e) => setSelectedMode(e.target.value)}
        aria-label={t('chat.modes.switcherLabel')}
        className="border-input bg-background text-foreground hover:border-ring focus-visible:ring-ring w-full cursor-pointer appearance-none bg-none truncate rounded-md border py-1 pl-2 pr-6 text-xs outline-none transition-colors focus-visible:ring-1"
      >
        {/* Same localized-label source as mode-switcher.tsx (`chat.modes.*`
            + isKnownMode, D3-pattern for unknown modes) — labels here must
            not fall back to `modeOptions[key]`, which is the English-only
            registry description, or the DE select leaks raw English. */}
        {modeKeys.map((key) => {
          const label = isKnownMode(key)
            ? t(`chat.modes.${key}`)
            : key.charAt(0).toUpperCase() + key.slice(1)
          return (
            <option key={key} value={key}>
              {label}
            </option>
          )
        })}
      </select>
      {/* `appearance-none` above drops the browser-default arrow, so we draw
          our own — purely decorative, the select itself stays keyboard/AT
          accessible as a native control. */}
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2"
      />
    </div>
  )
}

/**
 * Compact embedded credits readout for embedded mode. Reads the same
 * `useSettingsStore` state (and its existing fetch) that `CreditsFooter` uses
 * for the sidebar — no separate fetching logic. Deliberately trimmed down
 * from `CreditsFooter` (no progress bar, no cost-hint/reset copy): a small
 * embed has little vertical room, and `chat.credits.exhausted` already states
 * that model availability may change, so no separate
 * `settingsPanel.usingFallbackModel` text is needed.
 */
export function EmbeddedCreditsBar() {
  const t = useTranslations()
  const credits = useSettingsStore((state) => state.credits)
  const creditsLoaded = useSettingsStore((state) => state.creditsLoaded)

  // Same reasoning as CreditsFooter: say nothing before the fetch resolves
  // (or if it fails) rather than show a placeholder that could claim 0
  // credits when the real number just hasn't loaded yet.
  if (!creditsLoaded) return null

  const exhausted = credits.current === 0
  // A percentage is the most compact honest shape for the tiny embedded bar:
  // it avoids the "3 / 3" width while still degrading visibly as the student
  // spends credits. Rounding down can never advertise more than is left.
  const percent =
    credits.total > 0
      ? Math.max(0, Math.floor((credits.current / credits.total) * 100))
      : 0

  return (
    <div data-cy="chat-embedded-credits-bar" className="min-w-0 text-xs">
      <div className="flex items-center gap-1">
        <Zap className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground whitespace-nowrap">
          {t('chat.credits.embeddedLabel', { percent })}
        </span>
      </div>
      {exhausted && (
        <p
          data-cy="chat-embedded-credits-empty-message"
          className="text-muted-foreground mt-0.5"
        >
          {t('chat.credits.exhausted')}
        </p>
      )}
    </div>
  )
}

export function EmbeddedNewConversation() {
  const t = useTranslations()
  const locale = useLocale()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const pending = useRef(false)
  const [creating, setCreating] = useState(false)
  const createThread = useChatStore((state) => state.createThread)
  const blocked = useChatStore(
    (state) =>
      state.isLoading ||
      state.participationRequired ||
      Boolean(
        state.threads.find((thread) => thread.id === state.activeThreadId)
          ?.isRunning
      )
  )

  const startConversation = async () => {
    if (pending.current || blocked) return
    pending.current = true
    setCreating(true)
    try {
      const threadId = await createThread(chatbotId, { background: true })
      window.history.pushState(
        null,
        '',
        `/${chatbotId}/threads/${threadId}?embed=true&locale=${encodeURIComponent(locale)}`
      )
    } catch {
      // Thread creation reports failures through the shared store.
    } finally {
      pending.current = false
      setCreating(false)
    }
  }

  return (
    <button
      type="button"
      data-cy="chat-embedded-new-conversation"
      onClick={startConversation}
      disabled={blocked || creating}
      aria-label={t('chat.sidebar.newChat')}
      title={t('chat.sidebar.newChat')}
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
    >
      <Plus aria-hidden="true" className="size-4" />
    </button>
  )
}

// Closes the embedded conversation by posting the close request to the host
// window. The host decides what closing means (it hides the panel and returns
// focus to its launcher); without a host there is nothing to close, so the
// button does not render. Sending with '*': the frame is embedded by approved
// hosts only and the message carries no data beyond its type, which the host
// verifies against the frame's own origin before acting on it.
export function EmbeddedCloseButton() {
  const t = useTranslations()
  const embedded = useEmbedded()
  // The guard is decided on the client after mount so SSR renders nothing and
  // hydration does not flip a visible button into nothing (or the reverse).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const inFrame =
    mounted && typeof window !== 'undefined' && window.parent !== window
  if (!embedded || !inFrame) return null

  return (
    <button
      type="button"
      data-cy="chat-embedded-close"
      onClick={() => {
        window.parent.postMessage({ type: EMBEDDED_CLOSE_MESSAGE_TYPE }, '*')
      }}
      aria-label={t('chat.embedded.close')}
      title={t('chat.embedded.close')}
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  )
}
