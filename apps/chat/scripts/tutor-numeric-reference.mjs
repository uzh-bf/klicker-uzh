// Annual cash flows and decimal rates only. Callers annotate claims and convert
// their units before comparison; this reference does not interpret model prose.
export function calculateTutorReference(formula, inputs) {
  const fields = {
    presentValue: ['amount', 'rate', 'years'],
    futureValue: ['amount', 'rate', 'years'],
    couponBond: ['faceValue', 'couponRate', 'yieldRate', 'years'],
    capm: ['riskFreeRate', 'beta', 'marketReturn'],
  }[formula]
  if (
    !Array.isArray(fields) ||
    inputs === null ||
    typeof inputs !== 'object' ||
    Array.isArray(inputs) ||
    Object.keys(inputs).length !== fields.length ||
    !fields.every(
      (field) => Object.hasOwn(inputs, field) && Number.isFinite(inputs[field])
    )
  ) {
    throw new Error('Invalid numerical reference inputs')
  }

  const { amount, rate, years, faceValue, couponRate, yieldRate } = inputs
  if (
    formula !== 'capm' &&
    (!Number.isSafeInteger(years) || years < 0 || years > 1000)
  ) {
    throw new Error('Years must be a whole number from 0 to 1000')
  }

  let expected
  if (formula === 'capm') {
    expected =
      inputs.riskFreeRate +
      inputs.beta * (inputs.marketReturn - inputs.riskFreeRate)
  } else if (formula === 'couponBond') {
    if (faceValue <= 0 || couponRate < 0 || yieldRate <= -1 || years < 1) {
      throw new Error('Invalid annual coupon bond inputs')
    }
    expected = faceValue / (1 + yieldRate) ** years
    for (let year = 1; year <= years; year += 1) {
      expected += (faceValue * couponRate) / (1 + yieldRate) ** year
    }
  } else {
    if (rate <= -1) {
      throw new Error('Compounding rate must exceed -1')
    }
    expected =
      formula === 'presentValue'
        ? amount / (1 + rate) ** years
        : amount * (1 + rate) ** years
  }
  if (!Number.isFinite(expected)) {
    throw new Error('Numerical reference result is not finite')
  }
  return expected
}

export function compareTutorNumericClaim({
  formula,
  inputs,
  claim,
  tolerance,
}) {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('Tolerance must be finite and nonnegative')
  }
  const expected = calculateTutorReference(formula, inputs)
  if (claim === null || claim === undefined) {
    return { status: 'unassessed', expected, absoluteError: null }
  }
  if (!Number.isFinite(claim)) {
    throw new Error('Numerical claim must be finite')
  }
  const absoluteError = Math.abs(claim - expected)
  return {
    status: absoluteError <= tolerance ? 'pass' : 'fail',
    expected,
    absoluteError,
  }
}
