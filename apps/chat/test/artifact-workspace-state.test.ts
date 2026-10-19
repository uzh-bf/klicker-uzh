import { describe, expect, test } from 'vitest'
import {
  activeArtifactId,
  artifactWorkspaceReducer,
  type CodeArtifact,
  clearThreadWorkingCode,
  initialArtifactWorkspaceState,
  restoreWorkingCode,
  saveWorkingCode,
  type WorkingCodeTarget,
  workingCodeKey,
} from '../src/components/artifact-workspace-state'

class MemoryStorage {
  private entries = new Map<string, string>()
  get length() {
    return this.entries.size
  }
  key(index: number) {
    return Array.from(this.entries.keys())[index] ?? null
  }
  getItem(key: string) {
    return this.entries.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value)
  }
  removeItem(key: string) {
    this.entries.delete(key)
  }
  keys() {
    return Array.from(this.entries.keys())
  }
}

class ThrowingStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('denied')
  }
  setItem() {
    throw new Error('quota')
  }
}

const asStorage = (storage: MemoryStorage) => storage as unknown as Storage

const artifact: CodeArtifact = {
  id: 'call-1',
  kind: 'code',
  profile: 'python-core',
  starterCode: 'print("starter")',
}
const target: WorkingCodeTarget = {
  scope: 'scope-a',
  chatbotId: 'bot-1',
  threadId: 'thread-1',
}

describe('workspace reducer', () => {
  test('registration is idempotent and never resets edits', () => {
    let state = artifactWorkspaceReducer(initialArtifactWorkspaceState, {
      type: 'register',
      artifact,
    })
    state = artifactWorkspaceReducer(state, {
      type: 'edit-code',
      artifactId: artifact.id,
      code: 'edited',
    })
    const again = artifactWorkspaceReducer(state, {
      type: 'register',
      artifact: { ...artifact, starterCode: 'changed' },
      restoredCode: 'other',
    })
    expect(again).toBe(state)
    expect(again.workingCode[artifact.id]).toBe('edited')
  })

  test('restored code is the first working value', () => {
    const state = artifactWorkspaceReducer(initialArtifactWorkspaceState, {
      type: 'register',
      artifact,
      restoredCode: 'saved',
    })
    expect(state.workingCode[artifact.id]).toBe('saved')
  })

  test('opens and closes a registered artifact only', () => {
    const registered = artifactWorkspaceReducer(initialArtifactWorkspaceState, {
      type: 'register',
      artifact,
    })
    expect(
      artifactWorkspaceReducer(registered, { type: 'open', artifactId: 'x' })
    ).toBe(registered)
    const opened = artifactWorkspaceReducer(registered, {
      type: 'open',
      artifactId: artifact.id,
    })
    expect(activeArtifactId(opened.view)).toBe(artifact.id)
    expect(opened.opened).toEqual([artifact.id])
    expect(artifactWorkspaceReducer(opened, { type: 'close' }).view).toBeNull()
  })

  test('clear keeps the graph view and the storage fallback flag', () => {
    let state = artifactWorkspaceReducer(initialArtifactWorkspaceState, {
      type: 'show-graph',
    })
    state = artifactWorkspaceReducer(state, { type: 'storage-failed' })
    const cleared = artifactWorkspaceReducer(state, { type: 'clear' })
    expect(cleared.view).toBe('graph')
    expect(cleared.storageFallback).toBe(true)
    expect(cleared.artifacts).toEqual([])
  })

  test('a hidden branch closes its active view but keeps local state', () => {
    let state = artifactWorkspaceReducer(initialArtifactWorkspaceState, {
      type: 'register',
      artifact,
    })
    state = artifactWorkspaceReducer(state, {
      type: 'anchor-mounted',
      artifactId: artifact.id,
    })
    state = artifactWorkspaceReducer(state, {
      type: 'edit-code',
      artifactId: artifact.id,
      code: 'edited',
    })
    state = artifactWorkspaceReducer(state, {
      type: 'open',
      artifactId: artifact.id,
    })
    state = artifactWorkspaceReducer(state, {
      type: 'anchor-unmounted',
      artifactId: artifact.id,
    })
    expect(state.view).toBeNull()
    expect(state.present[artifact.id]).toBe(0)
    expect(state.opened).toEqual([artifact.id])
    expect(state.workingCode[artifact.id]).toBe('edited')
  })
})

describe('working code storage', () => {
  test('round trips an edit and removes the entry at the starter', () => {
    const storage = new MemoryStorage()
    expect(
      saveWorkingCode(asStorage(storage), target, artifact, 'edited')
    ).toBe(true)
    expect(restoreWorkingCode(asStorage(storage), target, artifact)).toEqual({
      code: 'edited',
      failed: false,
    })
    saveWorkingCode(asStorage(storage), target, artifact, artifact.starterCode)
    expect(storage.keys()).toEqual([])
  })

  test.each([
    ['profile', { profile: 'r-base' as const }],
    ['starter', { starterCode: 'other' }],
  ])('rejects a mismatched %s and removes only that key', (_name, change) => {
    const storage = new MemoryStorage()
    storage.setItem('unrelated', 'keep')
    saveWorkingCode(asStorage(storage), target, artifact, 'edited')
    const restored = restoreWorkingCode(asStorage(storage), target, {
      ...artifact,
      ...change,
    })
    expect(restored).toEqual({ failed: false })
    expect(storage.keys()).toEqual(['unrelated'])
  })

  test('rejects another envelope version and malformed JSON', () => {
    const storage = new MemoryStorage()
    const key = workingCodeKey(target, artifact.id)
    storage.setItem(
      key,
      JSON.stringify({
        v: 2,
        profile: artifact.profile,
        starterCode: artifact.starterCode,
        code: 'x',
      })
    )
    expect(
      restoreWorkingCode(asStorage(storage), target, artifact).code
    ).toBeUndefined()
    expect(storage.keys()).toEqual([])
    storage.setItem(key, '{not json')
    expect(
      restoreWorkingCode(asStorage(storage), target, artifact).code
    ).toBeUndefined()
    expect(storage.keys()).toEqual([])
  })

  test('scopes and threads never collide', () => {
    const storage = new MemoryStorage()
    const other = { ...target, scope: 'scope-b' }
    const otherThread = { ...target, threadId: 'thread-2' }
    saveWorkingCode(asStorage(storage), target, artifact, 'a')
    saveWorkingCode(asStorage(storage), other, artifact, 'b')
    saveWorkingCode(asStorage(storage), otherThread, artifact, 'c')
    expect(restoreWorkingCode(asStorage(storage), target, artifact).code).toBe(
      'a'
    )
    expect(restoreWorkingCode(asStorage(storage), other, artifact).code).toBe(
      'b'
    )
    expect(
      restoreWorkingCode(asStorage(storage), otherThread, artifact).code
    ).toBe('c')
    expect(new Set(storage.keys()).size).toBe(3)
  })

  test('reports failure when storage throws or is unavailable', () => {
    const throwing = new ThrowingStorage()
    expect(restoreWorkingCode(asStorage(throwing), target, artifact)).toEqual({
      failed: true,
    })
    expect(saveWorkingCode(asStorage(throwing), target, artifact, 'x')).toBe(
      false
    )
    expect(restoreWorkingCode(null, target, artifact).failed).toBe(true)
    expect(saveWorkingCode(null, target, artifact, 'x')).toBe(false)
  })

  test('thread cleanup removes only that thread keys', () => {
    const storage = new MemoryStorage()
    storage.setItem('unrelated', 'keep')
    saveWorkingCode(asStorage(storage), target, artifact, 'a')
    saveWorkingCode(
      asStorage(storage),
      target,
      { ...artifact, id: 'call-2' },
      'b'
    )
    const otherThread = { ...target, threadId: 'thread-2' }
    saveWorkingCode(asStorage(storage), otherThread, artifact, 'c')
    const otherBot = { ...target, chatbotId: 'bot-2' }
    saveWorkingCode(asStorage(storage), otherBot, artifact, 'd')
    clearThreadWorkingCode(asStorage(storage), 'bot-1', 'thread-1')
    expect(storage.keys().sort()).toEqual(
      [
        'unrelated',
        workingCodeKey(otherThread, artifact.id),
        workingCodeKey(otherBot, artifact.id),
      ].sort()
    )
  })
})
