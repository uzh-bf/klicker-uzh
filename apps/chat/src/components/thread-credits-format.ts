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

// Credit balances are stored as Decimal(18,6), so they are exact in whole
// micro-credits. Working in those integers keeps the floor below exact without
// an epsilon, which could lift a balance just under a boundary to the next
// percent.
const MICRO_CREDITS = 1_000_000

/**
 * Remaining credits as a whole percentage of the budget, rounded down so it
 * never advertises more than is left (2.97 of 3 is 99, 2.999 of 3 is 99).
 */
export const creditPercent = (current: number, total: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(total)) return 0
  const currentMicro = Math.round(current * MICRO_CREDITS)
  const totalMicro = Math.round(total * MICRO_CREDITS)
  if (totalMicro <= 0 || currentMicro <= 0) return 0
  return Math.min(100, Math.floor((currentMicro * 100) / totalMicro))
}

/**
 * The percentage label shared by the sidebar footer, the mobile bar and the
 * embedded chip, so all three show the same text. A positive balance below 1%
 * reads "<1" rather than "0", which would look like the credits are used up.
 */
export const formatCreditPercent = (current: number, total: number) => {
  const percent = creditPercent(current, total)
  const hasCredits =
    Number.isFinite(current) && Math.round(current * MICRO_CREDITS) > 0
  return percent === 0 && hasCredits && Number.isFinite(total) && total > 0
    ? '<1'
    : String(percent)
}
