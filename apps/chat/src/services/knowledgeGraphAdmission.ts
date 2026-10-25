// Per-process admission: no queue, bounded identity storage, and no release
// until the underlying graph read settles. Replicas have independent budgets.
export function createKnowledgeGraphAdmission() {
  const participants = new Map<
    string,
    { startedAt: number; requests: number; active: number }
  >()
  let active = 0

  return {
    acquire(participantId: string, now = Date.now()) {
      for (const [id, entry] of participants) {
        if (entry.active === 0 && now - entry.startedAt >= 60_000) {
          participants.delete(id)
        }
      }
      const entry = participants.get(participantId) ?? {
        startedAt: now,
        requests: 0,
        active: 0,
      }
      if (now - entry.startedAt >= 60_000) {
        entry.startedAt = now
        entry.requests = 0
      }
      if (
        active >= 8 ||
        entry.active >= 2 ||
        (!participants.has(participantId) && participants.size >= 2000)
      ) {
        return { allowed: false as const, retryAfterSeconds: 1 }
      }
      if (entry.requests >= 60) {
        return {
          allowed: false as const,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((entry.startedAt + 60_000 - now) / 1000)
          ),
        }
      }
      participants.set(participantId, entry)
      entry.requests += 1
      entry.active += 1
      active += 1
      let released = false
      return {
        allowed: true as const,
        release() {
          if (released) return
          released = true
          entry.active -= 1
          active -= 1
        },
      }
    },
  }
}
