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

// Per-message costs range from a few hundredths of a credit down to well
// below 0.001 (the BASE fallback model charges about 0.0005 for a typical
// exchange), so the balance needs four decimals before most messages move it.
const BALANCE_DECIMALS = 4

/**
 * Renders a remaining credit balance so that a charged message visibly moves
 * it. Balances keep up to four decimals (trailing zeros trimmed, so a fresh
 * balance still reads "3" and 2.98 reads "2.98") and are truncated rather than
 * rounded, so the display never overstates what is left: 2.99999 shows
 * "2.9999", not "3", and 0.0049 shows "0.0049", not "0.005". Balances below
 * 0.0001 keep their first significant digit so they do not read as "0" while
 * they can still be spent.
 */
export const formatCreditBalance = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0'

  const decimals = Math.max(BALANCE_DECIMALS, -Math.floor(Math.log10(value)))
  const factor = 10 ** decimals
  // The epsilon absorbs binary representation error (0.29 * 10000 is
  // 2899.9999999999995); stored balances have at most six decimals, so it
  // never lifts a value into the next step.
  const truncated = Math.floor(value * factor + 1e-6) / factor
  return truncated
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
