/** "B1.2 – B2.1", a single label for a one-level range, "–" without one. */
export function formatAdaptiveLevelRange({
  lowerLevelLabel,
  upperLevelLabel,
}: {
  lowerLevelLabel?: string | null
  upperLevelLabel?: string | null
}) {
  if (!lowerLevelLabel || !upperLevelLabel) return '–'
  return lowerLevelLabel === upperLevelLabel
    ? lowerLevelLabel
    : `${lowerLevelLabel} – ${upperLevelLabel}`
}
