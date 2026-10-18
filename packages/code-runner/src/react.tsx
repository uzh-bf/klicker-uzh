'use client'

import {
  AlertCircleIcon,
  LoaderCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { type CodeRunHandle, type CodeRunPhase, runCode } from './bridge'
import { detectBrowserEngine, isCodeExecutionSupported } from './engine'
import { type CodeProfile, MAX_CODE_LENGTH } from './profiles'
import type { CodeRunResult } from './protocol'

const LANGUAGE_KEYS = {
  'python-core': 'python',
  'r-base': 'r',
} as const satisfies Record<CodeProfile, string>

const SECONDARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** The translated display name of a profile's language, such as "Python". */
export function useCodeLanguageName(profile: CodeProfile): string {
  const t = useTranslations()
  return t(`shared.codeRunner.languages.${LANGUAGE_KEYS[profile]}`)
}

/**
 * Editor with Run, Stop and Reset for one runtime profile. Code runs only in
 * this browser, in a fresh sandboxed runner per run. Edits and output live in
 * component state and are lost on unmount. The host decides whether the
 * profile is admitted: `blockedNotice` explains why running is unavailable
 * and disables Run. Browsers outside the qualified engines get their own
 * notice.
 */
export function CodeRunner({
  profile,
  starterCode,
  blockedNotice,
}: {
  profile: CodeProfile
  starterCode: string
  blockedNotice?: string
}) {
  const t = useTranslations()
  const language = useCodeLanguageName(profile)
  const editorId = useId()
  // Engine support is decided in the browser after hydration.
  const [supported, setSupported] = useState<boolean | null>(null)
  const [code, setCode] = useState(starterCode)
  const [phase, setPhase] = useState<CodeRunPhase | null>(null)
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null)
  const handleRef = useRef<CodeRunHandle | null>(null)

  useEffect(() => {
    setSupported(
      isCodeExecutionSupported(detectBrowserEngine(navigator.userAgent))
    )
    return () => handleRef.current?.stop()
  }, [])

  const busy = phase !== null
  const canRun = !blockedNotice && supported === true

  async function handleRun() {
    if (busy) return
    setRunResult(null)
    const handle = runCode(profile, code, { onPhase: setPhase })
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
    setCode(starterCode)
    setRunResult(null)
  }

  const statusText = busy
    ? phase === 'loading'
      ? t('shared.codeRunner.starting', { language })
      : t('shared.codeRunner.running')
    : runResult
      ? t(`shared.codeRunner.status.${runResult.status}`)
      : ''

  return (
    <div className="space-y-3">
      <label
        className="block text-xs font-medium text-slate-600"
        htmlFor={editorId}
      >
        {t('shared.codeRunner.editorLabel', { language })}
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
        <Notice>{t('shared.codeRunner.unsupportedBrowser')}</Notice>
      )}
      {supported !== false && blockedNotice && <Notice>{blockedNotice}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={PRIMARY_BUTTON}
          disabled={!canRun || busy}
          onClick={handleRun}
          type="button"
        >
          <PlayIcon aria-hidden className="size-4" />
          {t('shared.codeRunner.run')}
        </button>
        <button
          className={SECONDARY_BUTTON}
          disabled={!busy}
          onClick={handleStop}
          type="button"
        >
          <SquareIcon aria-hidden className="size-4" />
          {t('shared.codeRunner.stop')}
        </button>
        <button
          className={SECONDARY_BUTTON}
          onClick={handleReset}
          type="button"
        >
          <RotateCcwIcon aria-hidden className="size-4" />
          {t('shared.codeRunner.reset')}
        </button>
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-sm text-slate-600"
          data-cy="code-runner-status"
          role="status"
        >
          {busy && (
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
          )}
          {statusText}
        </span>
      </div>

      {runResult && (
        <div className="space-y-2" data-cy="code-runner-output">
          {runResult.stdout && (
            <div>
              <p className="text-xs font-medium text-slate-600">
                {t('shared.codeRunner.output')}
              </p>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-50">
                {runResult.stdout}
              </pre>
            </div>
          )}
          {(runResult.stderr || runResult.error) && (
            <div>
              <p className="text-xs font-medium text-red-700">
                {t('shared.codeRunner.errorOutput')}
              </p>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-900">
                {[runResult.stderr, runResult.error].filter(Boolean).join('\n')}
              </pre>
            </div>
          )}
          {!runResult.stdout && !runResult.stderr && !runResult.error && (
            <p className="text-sm text-slate-600">
              {t('shared.codeRunner.noOutput')}
            </p>
          )}
          {runResult.truncated && (
            <p className="text-xs text-slate-600">
              {t('shared.codeRunner.truncated')}
            </p>
          )}
          {runResult.blockedAccess && (
            <p className="text-xs text-slate-600">
              {t('shared.codeRunner.blockedAccess')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
