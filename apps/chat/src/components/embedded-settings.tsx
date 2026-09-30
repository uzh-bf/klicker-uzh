'use client'

import { ChevronDown, Plus, X, Zap } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useChatContextStore } from '../stores/chatContextStore'
import { twMerge } from 'tailwind-merge'
import { isKnownMode } from '../lib/config/modes'
import { useEmbedded } from '../hooks/useEmbedded'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatUi } from './chat-ui-context'

// Host contract for closing the embedded conversation from inside the chat.
const EMBEDDED_CLOSE_MESSAGE_TYPE = 'klicker:chat-close'

/**
 * Target origin for messages the frame sends to its embedding page.
 *
 * The stored parent origin was proven by the host itself: it is the sender of
 * an accepted context update, and the chat already addresses its
 * acknowledgements there. A host that has not sent one yet is still named by
 * the frame's referrer, which the embedding pages set on the loads they
 * initiate (the eLearning frame requests it as strict-origin-when-cross-origin,
 * so the origin arrives without a path). Addressing the concrete origin keeps a
 * message from reaching every page that ever embedded the frame, and a request
 * that finds no host is not sent at all.
 */
export function resolveHostTargetOrigin(
  parentOrigin: string | null,
  referrer: string
): string | null {
  if (parentOrigin) return parentOrigin
  if (!referrer) return null
  try {
    const { origin, protocol } = new URL(referrer)
    // An opaque origin serializes as "null", which is not a usable
    // targetOrigin; only a real http(s) page can host the frame.
    if (protocol !== 'http:' && protocol !== 'https:') return null
    return origin
  } catch {
    return null
  }
}

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

/**
 * The mode select itself, without any width constraint. Kept separate so the
 * embedded toolbar can let it fill the row while the sidebar and
 * owner-preview usages keep their own compact sizing.
 */
export function EmbeddedModeSelect({ className }: { className?: string }) {
  const t = useTranslations()
  const { selectedMode, modeOptions, setSelectedMode } = useSettingsStore()

  const modeKeys = Object.keys(modeOptions)

  return (
    <div className={twMerge('relative min-w-0', className)}>
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

export function EmbeddedSettings() {
  const { showMinimalSettings } = useChatUi()
  const { modeOptions } = useSettingsStore()

  if (!hasEmbeddedModeSettings(showMinimalSettings, modeOptions)) return null

  return (
    <EmbeddedModeSelect className="ml-auto max-w-[10rem] shrink sm:max-w-[12rem]" />
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
export function EmbeddedCreditsBar({ className }: { className?: string }) {
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

  // One line only: the bar has a single row of vertical room, so the exhausted
  // explanation lives in the tooltip and accessible name rather than a second
  // line that would push the mode select and actions around.
  return (
    <div
      data-cy="chat-embedded-credits-bar"
      className={twMerge(
        'flex min-w-0 shrink-0 items-center gap-1 text-xs',
        className
      )}
      title={exhausted ? t('chat.credits.exhausted') : undefined}
      aria-label={t('chat.credits.title')}
    >
      <Zap className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <span
        data-cy={exhausted ? 'chat-embedded-credits-empty-message' : undefined}
        className={twMerge(
          'whitespace-nowrap tabular-nums',
          exhausted ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {t('chat.credits.embeddedLabel', { percent })}
      </span>
    </div>
  )
}

export function EmbeddedNewConversation({ className }: { className?: string }) {
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
      className={twMerge(
        'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
        className
      )}
    >
      <Plus aria-hidden="true" className="size-4" />
    </button>
  )
}

// Closes the embedded conversation by posting the close request to the host
// window. The host decides what closing means (it hides the panel and returns
// focus to its launcher); without a host there is nothing to close, so the
// button does not render. The request is addressed at the host's own origin
// (see resolveHostTargetOrigin) and carries no data beyond its type, which the
// host verifies against the frame's own origin before acting on it.
export function EmbeddedCloseButton({ className }: { className?: string }) {
  const t = useTranslations()
  const embedded = useEmbedded()
  const parentOrigin = useChatContextStore((state) => state.parentOrigin)
  // The guard is decided on the client after mount so SSR renders nothing and
  // hydration does not flip a visible button into nothing (or the reverse).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const inFrame =
    mounted && typeof window !== 'undefined' && window.parent !== window
  const targetOrigin = inFrame
    ? resolveHostTargetOrigin(parentOrigin, document.referrer)
    : null
  if (!embedded || !inFrame || !targetOrigin) return null

  return (
    <button
      type="button"
      data-cy="chat-embedded-close"
      onClick={() => {
        window.parent.postMessage(
          { type: EMBEDDED_CLOSE_MESSAGE_TYPE },
          targetOrigin
        )
      }}
      aria-label={t('chat.embedded.close')}
      title={t('chat.embedded.close')}
      className={twMerge(
        'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2',
        className
      )}
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  )
}

/**
 * Single row of embedded chat controls, spanning the full panel width.
 *
 * The order reads state, then choice, then actions: the credits readout is
 * small and informational so it anchors the left edge, the mode select takes
 * the flexible middle as the primary control, and the two icon actions sit at
 * the end where they stay next to the panel edge. Letting the select grow
 * keeps the row filled instead of leaving a gap between the select and the
 * actions, while `min-w-0` and `truncate` still let the longest label
 * ("Ausführliche Antwort") degrade instead of overflowing.
 */
export function EmbeddedToolbar() {
  const { showMinimalSettings } = useChatUi()
  const { modeOptions } = useSettingsStore()
  const hasModeSelect = hasEmbeddedModeSettings(
    showMinimalSettings,
    modeOptions
  )

  return (
    <div
      data-cy="chat-embedded-toolbar"
      className="flex w-full min-w-0 items-center gap-2"
    >
      <EmbeddedCreditsBar />
      {/* The select takes the flexible middle so the row has no dead gap
          between the controls; without one the credits and the actions are
          the whole row and the actions still sit at the end. */}
      {hasModeSelect ? <EmbeddedModeSelect className="flex-1" /> : null}
      <EmbeddedNewConversation className="ml-auto" />
      <EmbeddedCloseButton />
    </div>
  )
}
