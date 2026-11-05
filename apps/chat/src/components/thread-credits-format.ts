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

/**
 * Renders a remaining credit balance so that every charged message visibly
 * moves it. Per-message costs are fractions of a credit (often 0.01–0.05), so
 * rounding the balance to whole credits left it stuck at e.g. "3" after
 * several messages. Balances keep up to two decimals and are truncated rather
 * than rounded, so the display never overstates what is left (2.999 shows
 * "2.99", not "3"). Below 0.01 the first significant digit is kept, so a
 * nearly-empty balance does not read as "0" while it can still be spent.
 */
export const formatCreditBalance = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 0.01) return formatCredits(value)

  // The epsilon absorbs binary representation error (0.29 * 100 is
  // 28.999999999999996); balances are stored with at most six decimals.
  const truncated = Math.floor(value * 100 + 1e-9) / 100
  return truncated
    .toFixed(2)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
