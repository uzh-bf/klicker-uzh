// Qualified browser code runtime profiles. Python is the Pyodide core with its
// standard library; R is webR with the base R distribution.
export const CODE_PROFILES = ['python-core', 'r-base'] as const

export type CodeProfile = (typeof CODE_PROFILES)[number]

/** Upper bound for what a learner can type into the editor. */
export const MAX_CODE_LENGTH = 50_000

export function isCodeProfile(value: unknown): value is CodeProfile {
  return (CODE_PROFILES as readonly unknown[]).includes(value)
}
