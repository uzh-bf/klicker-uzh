/**
 * Terminal-expiry state and execution isolation for one live-quiz block.
 *
 * The gate is bound to a semantic block identity (quiz id + execution), not
 * to object references: a rerender that supplies a newly allocated instances
 * array for the same block execution must not reset the terminal state while
 * a submission started before expiry is still in flight. Only a genuinely
 * new identity resets the gate.
 *
 * Isolation across executions is handled through capture scopes: an async
 * submission captures both its identity and its gate when it starts. A
 * completion may commit UI state only while its identity is still current
 * and its gate has not expired — an unexpired gate from a superseded
 * execution is stale exactly like an expired one.
 */
export interface BlockExpiryGate {
  readonly identity: string
  isExpired(): boolean
  markExpired(): void
}

export function createBlockExpiryGate(identity: string): BlockExpiryGate {
  let expired = false
  return {
    identity,
    isExpired() {
      return expired
    },
    markExpired() {
      expired = true
    },
  }
}

/**
 * Resets the gate only when the identity actually changed. Returns the gate
 * that is now current: either the existing one (same block execution) or a
 * freshly created gate for the new identity. The previous gate object is
 * left untouched — submissions that captured it must consult their identity
 * for currency, not just expiry.
 */
export function resetExpiryGate(
  current: BlockExpiryGate | null,
  identity: string
): BlockExpiryGate {
  if (current && current.identity === identity) {
    return current
  }
  return createBlockExpiryGate(identity)
}

/**
 * A capture scope for asynchronous block work (manual submissions, expiry
 * cleanup). `canCommitUi` is the authority for manual submission completions:
 * the execution must still be current and the gate must not have expired.
 * Expiry cleanup has a weaker authority, `isCurrent`: it runs legitimately on
 * an expired gate, but a superseded execution must not write into the newly
 * displayed one.
 */
export interface BlockSubmissionScope {
  readonly identity: string
  isCurrent(currentIdentity: string): boolean
  canCommitUi(currentIdentity: string): boolean
}

export function createSubmissionScope(
  identity: string,
  gate: BlockExpiryGate
): BlockSubmissionScope {
  return {
    identity,
    isCurrent(currentIdentity: string) {
      return identity === currentIdentity
    },
    canCommitUi(currentIdentity: string) {
      return identity === currentIdentity && !gate.isExpired()
    },
  }
}
