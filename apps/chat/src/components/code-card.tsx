'use client'

import type { CodeProfile } from '@klicker-uzh/code-runner'
import { CodeRunner, useCodeLanguageName } from '@klicker-uzh/code-runner/react'
import {
  AlertCircleIcon,
  LoaderCircleIcon,
  PanelRightOpenIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
} from 'react'
import { parseCodeCardResult } from '@/src/lib/code-runner/cardResult'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import {
  ArtifactSlot,
  type ArtifactWorkspaceValue,
  useArtifactWorkspace,
} from './artifact-workspace'
import {
  type Artifact,
  activeArtifactId,
  type CodeArtifact,
} from './artifact-workspace-state'
import { useEffectiveModeOptions } from './mode-options-context'

export function CodeCard({
  result,
  status,
  toolCallId,
}: {
  result: unknown
  status: { type: string }
  toolCallId?: string
}) {
  const t = useTranslations()
  const workspace = useArtifactWorkspace()
  const card = parseCodeCardResult(result)

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
  // Without a workspace or a tool call identity, the card stays inline and
  // owns its own edits.
  if (!workspace || !toolCallId) {
    return (
      <StandaloneCodeCard
        key={`${card.profile}:${card.starterCode}`}
        profile={card.profile}
        starterCode={card.starterCode}
      />
    )
  }
  return (
    <CodeCardAnchor
      workspace={workspace}
      artifact={{
        id: toolCallId,
        kind: 'code',
        profile: card.profile,
        starterCode: card.starterCode,
      }}
    />
  )
}

/**
 * The card's place in the conversation. It registers the artifact and shows
 * the mounted card here, or a short note while the workspace shows it.
 * Registering never opens the workspace or moves focus.
 */
function CodeCardAnchor({
  artifact,
  workspace,
}: {
  artifact: CodeArtifact
  workspace: ArtifactWorkspaceValue
}) {
  const t = useTranslations()
  const language = useCodeLanguageName(artifact.profile)
  const { register, anchorMounted } = workspace
  const { id, profile, starterCode } = artifact

  // Presence tells the workspace whether this card's branch is visible.
  useLayoutEffect(() => anchorMounted(id), [anchorMounted, id])

  useEffect(() => {
    register({ id, kind: 'code', profile, starterCode })
  }, [register, id, profile, starterCode])

  if (activeArtifactId(workspace.state.view) !== id) {
    return <ArtifactSlot artifactId={id} />
  }
  return (
    <div
      className="my-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      data-cy="code-card-opened"
    >
      <PanelRightOpenIcon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {t('chat.codeCard.openedInWorkspace', { language })}
      </span>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        data-cy="code-card-show-here"
        onClick={workspace.close}
        type="button"
      >
        {t('chat.codeCard.showHere')}
      </button>
    </div>
  )
}

/** Renders a registered artifact for the workspace provider. */
export function renderChatArtifact(artifact: Artifact) {
  return <CodeArtifactCard artifact={artifact} />
}

/**
 * The single mounted card of a code artifact. The workspace provider renders
 * it once; slots move it between the conversation and the workspace.
 */
export function CodeArtifactCard({ artifact }: { artifact: CodeArtifact }) {
  const t = useTranslations()
  const workspace = useArtifactWorkspace()
  if (!workspace) return null
  const inWorkspace = activeArtifactId(workspace.state.view) === artifact.id
  let notice: string | undefined
  let savedNote: string | undefined
  if (workspace.state.storageFallback) {
    notice = t('chat.codeCard.storageFallbackNote')
  } else if (!workspace.savesWorkingCode) {
    notice = t('chat.codeCard.previewNote')
  } else {
    savedNote = t('chat.codeCard.tabNote')
  }
  return (
    <CodeCardFrame
      code={workspace.state.workingCode[artifact.id] ?? artifact.starterCode}
      headerAction={
        inWorkspace ? null : (
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            data-artifact-launcher="true"
            data-cy="code-card-open"
            onClick={() => workspace.open(artifact.id)}
            type="button"
          >
            <PanelRightOpenIcon aria-hidden className="size-3.5" />
            {t('chat.codeCard.openInWorkspace')}
          </button>
        )
      }
      notice={notice}
      onCodeChange={(code) => workspace.editCode(artifact, code)}
      savedNote={savedNote}
      profile={artifact.profile}
      starterCode={artifact.starterCode}
    />
  )
}

function StandaloneCodeCard({
  profile,
  starterCode,
}: {
  profile: CodeProfile
  starterCode: string
}) {
  const [code, setCode] = useState(starterCode)
  return (
    <CodeCardFrame
      code={code}
      onCodeChange={setCode}
      profile={profile}
      starterCode={starterCode}
    />
  )
}

function CodeCardFrame({
  profile,
  starterCode,
  code,
  onCodeChange,
  headerAction,
  notice,
  savedNote,
}: {
  profile: CodeProfile
  starterCode: string
  code: string
  onCodeChange: (code: string) => void
  headerAction?: ReactNode
  notice?: string
  savedNote?: string
}) {
  const t = useTranslations()
  const titleId = useId()
  const language = useCodeLanguageName(profile)
  // The host's effective mode options, so owner preview admits exactly what
  // learners get.
  const modeOptions = useEffectiveModeOptions()
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const admitted =
    modeOptions[
      resolveSelectedMode(modeOptions, selectedMode)
    ]?.codeProfiles?.includes(profile) ?? false

  return (
    <section
      aria-labelledby={titleId}
      className="my-3 w-full space-y-3 rounded-md border border-slate-200 bg-white p-4 text-slate-950"
      data-cy="code-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" id={titleId}>
          {t('chat.codeCard.title')}
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {language}
          </span>
          {headerAction}
        </div>
      </div>
      <CodeRunner
        blockedNotice={admitted ? undefined : t('chat.codeCard.notAdmitted')}
        code={code}
        onCodeChange={onCodeChange}
        profile={profile}
        starterCode={starterCode}
      />
      <p className="text-xs text-slate-500">
        {t('chat.codeCard.localNote')}
        {savedNote ? ` ${savedNote}` : null}
      </p>
      {notice ? (
        <p
          className="text-xs font-medium text-amber-700"
          data-cy="code-card-storage-notice"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </section>
  )
}
