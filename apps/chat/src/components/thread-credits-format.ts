// Split out from thread.tsx (mirrors thread-list-state.ts): a plain .ts module
// with no component/UI-library imports, so the formatting rules can be
// unit-tested without dragging the whole thread component into vitest.

/**
 * Renders a credit amount for display: whole numbers stay whole, and values
 * below 1 keep just enough decimals to show their first significant digit
 * (0.009 stays "0.009" instead of collapsing to "0.01" or "0"). Only a
 * fractional tail is trimmed, never the zeros of an integer.
 */
export const formatCredits = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)
  if (absValue === 0) return '0'

  const decimals =
    absValue < 1 ? Math.max(1, -Math.floor(Math.log10(absValue))) : 0
  const rounded = value.toFixed(decimals)
  return rounded.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}
