import type { AdaptiveReadinessIssueLike } from './adaptiveReadinessIssue'

// Coverage issues are reported once per leaf × level cell. A large tree can
// produce hundreds of them, so they are summarized per code instead.
export const ADAPTIVE_COVERAGE_ISSUE_CODES = [
  'ADAPTIVE_COVERAGE_CELL_EMPTY',
  'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
  'ADAPTIVE_COVERAGE_BELOW_TARGET',
] as const

export type AdaptiveCoverageIssueCode =
  (typeof ADAPTIVE_COVERAGE_ISSUE_CODES)[number]

export function isAdaptiveCoverageIssueCode(
  code: string
): code is AdaptiveCoverageIssueCode {
  return (ADAPTIVE_COVERAGE_ISSUE_CODES as readonly string[]).includes(code)
}

export type AdaptiveReadinessEntry<T extends AdaptiveReadinessIssueLike> =
  | { kind: 'issue'; issue: T }
  | { kind: 'coverageGroup'; code: AdaptiveCoverageIssueCode; issues: T[] }

/**
 * Keeps non-coverage issues in their original order and replaces every
 * coverage issue code with one group (placed where the code first occurs)
 * whose cells are sorted by competence, leaf and level.
 */
export function groupAdaptiveReadinessIssues<
  T extends AdaptiveReadinessIssueLike,
>(issues: readonly T[]): AdaptiveReadinessEntry<T>[] {
  const entries: AdaptiveReadinessEntry<T>[] = []
  const groups = new Map<AdaptiveCoverageIssueCode, T[]>()

  for (const issue of issues) {
    if (!isAdaptiveCoverageIssueCode(issue.code)) {
      entries.push({ kind: 'issue', issue })
      continue
    }
    const group = groups.get(issue.code)
    if (group) {
      group.push(issue)
      continue
    }
    const created = [issue]
    groups.set(issue.code, created)
    entries.push({ kind: 'coverageGroup', code: issue.code, issues: created })
  }

  for (const group of groups.values()) group.sort(compareCoverageIssues)
  return entries
}

export function compareCoverageIssues(
  a: AdaptiveReadinessIssueLike,
  b: AdaptiveReadinessIssueLike
): number {
  const pa = a.parameters ?? {}
  const pb = b.parameters ?? {}
  return (
    compareNumbers(pa.leafOrder, pb.leafOrder) ||
    compareText(pa.rootName, pb.rootName) ||
    compareText(pa.leafName, pb.leafName) ||
    compareNumbers(a.leafNodeId, b.leafNodeId) ||
    compareNumbers(pa.levelOrder, pb.levelOrder) ||
    compareText(pa.levelLabel, pb.levelLabel) ||
    compareNumbers(a.levelId, b.levelId)
  )
}

/** "Competence › Leaf · Level", falling back to ids for older payloads. */
export function formatAdaptiveCoverageCell(
  issue: AdaptiveReadinessIssueLike
): string {
  const p = issue.parameters ?? {}
  const leafName =
    p.leafName ??
    (typeof issue.leafNodeId === 'number' ? `#${issue.leafNodeId}` : '?')
  const leaf =
    p.rootName && p.rootName !== p.leafName
      ? `${p.rootName} › ${leafName}`
      : leafName
  const level =
    p.levelLabel ??
    (typeof issue.levelId === 'number' ? `#${issue.levelId}` : '?')
  return `${leaf} · ${level}`
}

function compareNumbers(a?: number | null, b?: number | null) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return 0
}

function compareText(a?: string | null, b?: string | null) {
  if (a && b) return a.localeCompare(b, undefined, { numeric: true })
  if (a) return -1
  if (b) return 1
  return 0
}
