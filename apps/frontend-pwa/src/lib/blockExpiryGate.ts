/**
 * Terminal-expiry state for one live-quiz block execution.
 *
 * The gate is bound to a semantic block identity (quiz id + execution), not
 * to object references: a rerender that supplies a newly allocated instances
 * array for the same block execution must not reset the terminal state while
 * a submission started before expiry is still in flight. Only a genuinely
 * new identity resets the gate.
 *
 * Asynchronous work captures the gate instance it started under. A late
 * completion then consults its own captured gate, so state updates from a
 * submission belonging to a previous execution cannot leak into the new one.
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
 * freshly created gate for the new identity.
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
