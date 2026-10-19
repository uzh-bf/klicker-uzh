'use client'

import {
  AlertCircleIcon,
  LoaderCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'
import {
  type CodeRunHandle,
  type CodeRunPhase,
  runCode,
} from '@/src/lib/code-runner/bridge'
import { parseCodeCardResult } from '@/src/lib/code-runner/cardResult'
import {
  detectBrowserEngine,
  isCodeExecutionSupported,
} from '@/src/lib/code-runner/engine'
import {
  type CodeProfile,
  MAX_CODE_LENGTH,
} from '@/src/lib/code-runner/profiles'
import type { CodeRunResult } from '@/src/lib/code-runner/protocol'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { useEffectiveModeOptions } from './mode-options-context'

const LANGUAGE_KEYS = {
  'python-core': 'python',
  'r-base': 'r',
} as const satisfies Record<CodeProfile, string>

const SECONDARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function CodeCard({
  result,
  status,
}: {
  result: unknown
  status: { type: string }
}) {
  const t = useTranslations()
  const card = parseCodeCardResult(result)
  const editorId = useId()
  // The host's effective mode options, so owner preview admits exactly what
  // learners get.
  const modeOptions = useEffectiveModeOptions()
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const admitted =
    card !== null &&
    (modeOptions[
      resolveSelectedMode(modeOptions, selectedMode)
    ]?.codeProfiles?.includes(card.profile) ??
      false)
  // Engine support is decided in the browser after hydration.
  const [supported, setSupported] = useState<boolean | null>(null)
  const [code, setCode] = useState(card?.starterCode ?? '')
  const [phase, setPhase] = useState<CodeRunPhase | null>(null)
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null)
  const handleRef = useRef<CodeRunHandle | null>(null)

  useEffect(() => {
    setSupported(
      isCodeExecutionSupported(detectBrowserEngine(navigator.userAgent))
    )
    return () => handleRef.current?.stop()
  }, [])

  useEffect(() => {
    if (!card?.profile) return
    handleRef.current?.stop()
    handleRef.current = null
    setCode(card?.starterCode ?? '')
    setPhase(null)
    setRunResult(null)
  }, [card?.profile, card?.starterCode])

  if (status.type === 'running' && !card) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
        {t('chat.codeCard.opening')}
      </div>
    )
  }
  if (!card) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <AlertCircleIcon aria-hidden className="size-4" />
        {t('chat.codeCard.invalid')}
      </div>
    )
  }

  const language = t(`chat.codeCard.languages.${LANGUAGE_KEYS[card.profile]}`)
  const busy = phase !== null
  const canRun = admitted && supported === true

  async function handleRun() {
    if (!card || busy) return
    setRunResult(null)
    const handle = runCode(card.profile, code, { onPhase: setPhase })
    handleRef.current = handle
    const finished = await handle.result
    if (handleRef.current !== handle) return
    handleRef.current = null
    setPhase(null)
    setRunResult(finished)
  }

  function handleStop() {
    handleRef.current?.stop()
  }

  function handleReset() {
    // Detach the running attempt first, so its "stopped" result is not shown.
    const running = handleRef.current
    handleRef.current = null
    running?.stop()
    setPhase(null)
    setCode(card?.starterCode ?? '')
    setRunResult(null)
  }

  const statusText = busy
    ? phase === 'loading'
      ? t('chat.codeCard.starting', { language })
      : t('chat.codeCard.running')
    : runResult
      ? t(`chat.codeCard.status.${runResult.status}`)
      : ''

  return (
    <section
      aria-labelledby={`${editorId}-title`}
      className="my-3 w-full space-y-3 rounded-md border border-slate-200 bg-white p-4 text-slate-950"
      data-cy="code-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" id={`${editorId}-title`}>
          {t('chat.codeCard.title')}
        </h3>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {language}
        </span>
      </div>

      <label
        className="block text-xs font-medium text-slate-600"
        htmlFor={editorId}
      >
        {t('chat.codeCard.editorLabel', { language })}
      </label>
      <textarea
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="block min-h-32 w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
        id={editorId}
        maxLength={MAX_CODE_LENGTH}
        onChange={(event) => setCode(event.target.value)}
        rows={Math.min(Math.max(code.split('\n').length + 1, 5), 20)}
        spellCheck={false}
        value={code}
      />

      {supported === false && (
        <Notice>{t('chat.codeCard.unsupportedBrowser')}</Notice>
      )}
      {supported !== false && !admitted && (
        <Notice>{t('chat.codeCard.notAdmitted')}</Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={PRIMARY_BUTTON}
          disabled={!canRun || busy}
          onClick={handleRun}
          type="button"
        >
          <PlayIcon aria-hidden className="size-4" />
          {t('chat.codeCard.run')}
        </button>
        <button
          className={SECONDARY_BUTTON}
          disabled={!busy}
          onClick={handleStop}
          type="button"
        >
          <SquareIcon aria-hidden className="size-4" />
          {t('chat.codeCard.stop')}
        </button>
        <button
          className={SECONDARY_BUTTON}
          onClick={handleReset}
          type="button"
        >
          <RotateCcwIcon aria-hidden className="size-4" />
          {t('chat.codeCard.reset')}
        </button>
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-sm text-slate-600"
          data-cy="code-card-status"
          role="status"
        >
          {busy && (
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
          )}
          {statusText}
        </span>
      </div>

      {runResult && (
        <div className="space-y-2" data-cy="code-card-output">
          {runResult.stdout && (
            <div>
              <p className="text-xs font-medium text-slate-600">
                {t('chat.codeCard.output')}
              </p>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-50">
                {runResult.stdout}
              </pre>
            </div>
          )}
          {(runResult.stderr || runResult.error) && (
            <div>
              <p className="text-xs font-medium text-red-700">
                {t('chat.codeCard.errorOutput')}
              </p>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-900">
                {[runResult.stderr, runResult.error].filter(Boolean).join('\n')}
              </pre>
            </div>
          )}
          {!runResult.stdout && !runResult.stderr && !runResult.error && (
            <p className="text-sm text-slate-600">
              {t('chat.codeCard.noOutput')}
            </p>
          )}
          {runResult.truncated && (
            <p className="text-xs text-slate-600">
              {t('chat.codeCard.truncated')}
            </p>
          )}
          {runResult.blockedAccess && (
            <p className="text-xs text-slate-600">
              {t('chat.codeCard.blockedAccess')}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">{t('chat.codeCard.localNote')}</p>
    </section>
  )
}
