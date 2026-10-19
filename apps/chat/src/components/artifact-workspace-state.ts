import type { CodeProfile } from '@klicker-uzh/code-runner'
import type { PracticeQuizToolResult } from './student-practice-quiz-card'

/**
 * A completed tool result that can move between its inline place in the
 * conversation and the workspace beside it. The id is the tool call id.
 */
export interface CodeArtifact {
  id: string
  kind: 'code'
  profile: CodeProfile
  starterCode: string
}

/** A practice question from a completed tool result; answers stay in memory. */
export interface PracticeArtifact {
  id: string
  kind: 'practice'
  quiz: PracticeQuizToolResult
}

export type Artifact = CodeArtifact | PracticeArtifact

/** What the workspace shows: nothing, the knowledge graph, or one artifact. */
export type WorkspaceView = null | 'graph' | { artifactId: string }

export interface ArtifactWorkspaceState {
  /** Registered artifacts in registration order. */
  artifacts: Artifact[]
  /** Artifacts the learner has opened, in the order they were first opened. */
  opened: string[]
  view: WorkspaceView
  /** Working code per code artifact; absent until the learner edits it. */
  workingCode: Record<string, string>
  /** Mounted conversation anchors per artifact; zero when its branch is hidden. */
  present: Record<string, number>
  /** Working code could not be saved in this tab and lives in page memory. */
  storageFallback: boolean
}

export type ArtifactWorkspaceAction =
  | { type: 'register'; artifact: Artifact; restoredCode?: string }
  | { type: 'anchor-mounted'; artifactId: string }
  | { type: 'anchor-unmounted'; artifactId: string }
  | { type: 'storage-failed' }
  | { type: 'open'; artifactId: string }
  | { type: 'show-graph' }
  | { type: 'close' }
  | { type: 'edit-code'; artifactId: string; code: string }
  | { type: 'clear' }

export const initialArtifactWorkspaceState: ArtifactWorkspaceState = {
  artifacts: [],
  opened: [],
  view: null,
  workingCode: {},
  present: {},
  storageFallback: false,
}

export function activeArtifactId(view: WorkspaceView): string | null {
  return view !== null && view !== 'graph' ? view.artifactId : null
}

export function artifactWorkspaceReducer(
  state: ArtifactWorkspaceState,
  action: ArtifactWorkspaceAction
): ArtifactWorkspaceState {
  switch (action.type) {
    case 'register':
      // The first completed result for a tool call stays authoritative, so a
      // repeated render can never reset an edited artifact.
      if (state.artifacts.some(({ id }) => id === action.artifact.id)) {
        return state
      }
      return {
        ...state,
        artifacts: [...state.artifacts, action.artifact],
        workingCode:
          action.restoredCode === undefined
            ? state.workingCode
            : {
                ...state.workingCode,
                [action.artifact.id]: action.restoredCode,
              },
      }
    case 'anchor-mounted':
      return {
        ...state,
        present: {
          ...state.present,
          [action.artifactId]: (state.present[action.artifactId] ?? 0) + 1,
        },
      }
    case 'anchor-unmounted': {
      const count = state.present[action.artifactId] ?? 0
      if (count === 0) return state
      const present = { ...state.present, [action.artifactId]: count - 1 }
      // A hidden branch closes its workspace view but keeps its local state.
      const closesView =
        count === 1 && activeArtifactId(state.view) === action.artifactId
      return { ...state, present, view: closesView ? null : state.view }
    }
    case 'storage-failed':
      return state.storageFallback ? state : { ...state, storageFallback: true }
    case 'open':
      if (!state.artifacts.some(({ id }) => id === action.artifactId)) {
        return state
      }
      return {
        ...state,
        opened: state.opened.includes(action.artifactId)
          ? state.opened
          : [...state.opened, action.artifactId],
        view: { artifactId: action.artifactId },
      }
    case 'show-graph':
      return { ...state, view: 'graph' }
    case 'close':
      return state.view === null ? state : { ...state, view: null }
    case 'edit-code':
      return {
        ...state,
        workingCode: { ...state.workingCode, [action.artifactId]: action.code },
      }
    case 'clear':
      // The knowledge graph belongs to the chatbot, not to one conversation.
      return {
        ...initialArtifactWorkspaceState,
        storageFallback: state.storageFallback,
        view: state.view === 'graph' ? 'graph' : null,
      }
  }
}

const STORAGE_PREFIX = 'klicker.chat.workingCode.v1'

/** Where working code is saved; `scope` is the server-derived opaque owner key. */
export interface WorkingCodeTarget {
  scope: string
  chatbotId: string
  threadId: string
}

export function workingCodeKey(
  { scope, chatbotId, threadId }: WorkingCodeTarget,
  toolCallId: string
): string {
  return `${STORAGE_PREFIX}:${scope}:${chatbotId}:${threadId}:${toolCallId}`
}

/** The tab's session storage, or null where the browser denies access. */
export function getTabStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function removeQuietly(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Nothing else to do: the entry is ignored either way.
  }
}

/**
 * Returns saved working code for the artifact, or undefined when there is
 * none or it does not belong to this exact artifact. A mismatching entry is
 * removed; every other key stays untouched. `failed` reports storage errors.
 */
export function restoreWorkingCode(
  storage: Storage | null,
  target: WorkingCodeTarget,
  artifact: CodeArtifact
): { code?: string; failed: boolean } {
  if (!storage) return { failed: true }
  const key = workingCodeKey(target, artifact.id)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return { failed: true }
  }
  if (raw === null) return { failed: false }
  try {
    const envelope: unknown = JSON.parse(raw)
    if (
      typeof envelope === 'object' &&
      envelope !== null &&
      (envelope as { v?: unknown }).v === 1 &&
      (envelope as { profile?: unknown }).profile === artifact.profile &&
      (envelope as { starterCode?: unknown }).starterCode ===
        artifact.starterCode &&
      typeof (envelope as { code?: unknown }).code === 'string'
    ) {
      return { code: (envelope as { code: string }).code, failed: false }
    }
  } catch {
    // Malformed entries fall through to removal.
  }
  removeQuietly(storage, key)
  return { failed: false }
}

/**
 * Saves working code, or removes the entry when it equals the starter again.
 * Returns false when the browser refused, so the caller can warn the learner.
 */
export function saveWorkingCode(
  storage: Storage | null,
  target: WorkingCodeTarget,
  artifact: CodeArtifact,
  code: string
): boolean {
  if (!storage) return false
  const key = workingCodeKey(target, artifact.id)
  try {
    if (code === artifact.starterCode) {
      storage.removeItem(key)
    } else {
      storage.setItem(
        key,
        JSON.stringify({
          v: 1,
          profile: artifact.profile,
          starterCode: artifact.starterCode,
          code,
        })
      )
    }
    return true
  } catch {
    return false
  }
}

/**
 * Removes the saved working code of one deleted thread. Thread ids are unique
 * to their owner, so the owner scope segment is not needed to match.
 */
export function clearThreadWorkingCode(
  storage: Storage | null,
  chatbotId: string,
  threadId: string
) {
  if (!storage) return
  try {
    const matching: string[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(`${STORAGE_PREFIX}:`)) continue
      const rest = key.slice(STORAGE_PREFIX.length + 1)
      const afterScope = rest.slice(rest.indexOf(':') + 1)
      if (afterScope.startsWith(`${chatbotId}:${threadId}:`)) matching.push(key)
    }
    for (const key of matching) storage.removeItem(key)
  } catch {
    // Cleanup is best effort; the entries are unreachable without the thread.
  }
}
