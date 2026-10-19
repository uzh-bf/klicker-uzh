import type { CodeProfile } from '@klicker-uzh/code-runner'

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

export type Artifact = CodeArtifact

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
}

export type ArtifactWorkspaceAction =
  | { type: 'register'; artifact: Artifact }
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
      return { ...state, artifacts: [...state.artifacts, action.artifact] }
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
        view: state.view === 'graph' ? 'graph' : null,
      }
  }
}
