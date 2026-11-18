/**
 * Only explicitly authored messages may reach the operator terminal. `code`
 * tells API callers whether previewing again can resolve the failure.
 */
export class ElementImportError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'STALE'
      | 'LIBRARY_TOO_LARGE'
      | 'INVALID_OWNER'
      | 'VERIFICATION_FAILED'
      | 'INVALID_INPUT' = 'INVALID_INPUT'
  ) {
    super(message)
  }
}
