/** A snapshot may only be applied if no newer event or connection change was observed. */
export function createLiveQuizRecovery<T>({
  read,
  apply,
  onState,
}: {
  read: () => Promise<T>
  apply: (value: T) => void
  onState: (state: 'synchronizing' | 'ready' | 'failed') => void
}) {
  let generation = 0
  let disposed = false
  let pending: Promise<void> | undefined
  let changed = false

  async function drain() {
    let attempts = 0
    do {
      attempts++
      changed = false
      const started = generation
      onState('synchronizing')
      try {
        const value = await read()
        if (disposed) return
        if (started !== generation) {
          if (attempts >= 3) {
            onState('failed')
            return
          }
          continue
        }
        apply(value)
        onState('ready')
      } catch {
        if (disposed) return
        if (started !== generation && attempts < 3) continue
        onState('failed')
        return
      }
    } while (!disposed && changed)
  }

  return {
    invalidate() {
      generation++
      changed = true
    },
    refresh() {
      if (disposed) return Promise.resolve()
      pending ??= drain().finally(() => {
        pending = undefined
      })
      return pending
    },
    dispose() {
      disposed = true
      generation++
    },
  }
}
