export type Interval95 = {
  lower: number
  upper: number
}

export function wilsonInterval(
  successes: number,
  total: number,
  z: number
): Interval95 {
  if (
    !Number.isInteger(successes) ||
    !Number.isInteger(total) ||
    successes < 0 ||
    total < 0 ||
    successes > total ||
    !Number.isFinite(z) ||
    z <= 0
  ) {
    throw new TypeError('Wilson interval inputs are invalid.')
  }
  if (total === 0) return { lower: 0, upper: 1 }

  const proportion = successes / total
  const zSquared = z * z
  const denominator = 1 + zSquared / total
  const center = (proportion + zSquared / (2 * total)) / denominator
  const radius =
    (z / denominator) *
    Math.sqrt(
      (proportion * (1 - proportion)) / total + zSquared / (4 * total * total)
    )
  return {
    lower: successes === 0 ? 0 : Math.max(0, center - radius),
    upper: successes === total ? 1 : Math.min(1, center + radius),
  }
}

export function deterministicBootstrapUpper({
  values,
  seed,
  replicates,
  statistic,
}: {
  values: readonly number[]
  seed: number
  replicates: number
  statistic: (sample: number[]) => number
}) {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value)) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(replicates) ||
    replicates < 1
  ) {
    throw new TypeError('Deterministic bootstrap inputs are invalid.')
  }

  const random = createRandom(seed)
  const statistics = Array.from({ length: replicates }, () => {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(random() * values.length)]!
    )
    const result = statistic(sample)
    if (!Number.isFinite(result)) {
      throw new TypeError('Bootstrap statistics must be finite.')
    }
    return result
  }).sort((left, right) => left - right)
  return percentile(statistics, 0.95)
}

export function deterministicBootstrapDifferenceLower({
  left,
  right,
  seed,
  replicates,
}: {
  left: readonly number[]
  right: readonly number[]
  seed: number
  replicates: number
}) {
  if (
    left.length === 0 ||
    right.length === 0 ||
    left.some((value) => !Number.isFinite(value)) ||
    right.some((value) => !Number.isFinite(value)) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(replicates) ||
    replicates < 1
  ) {
    throw new TypeError(
      'Deterministic difference bootstrap inputs are invalid.'
    )
  }

  const random = createRandom(seed)
  const statistics = Array.from({ length: replicates }, () => {
    const leftSample = Array.from(
      { length: left.length },
      () => left[Math.floor(random() * left.length)]!
    )
    const rightSample = Array.from(
      { length: right.length },
      () => right[Math.floor(random() * right.length)]!
    )
    return Math.abs(mean(leftSample) - mean(rightSample))
  }).sort((first, second) => first - second)

  return percentile(statistics, 0.05)
}

export function deterministicBootstrapAbsoluteMeanLower({
  values,
  seed,
  replicates,
}: {
  values: readonly number[]
  seed: number
  replicates: number
}) {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value)) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(replicates) ||
    replicates < 1
  ) {
    throw new TypeError(
      'Deterministic absolute-mean bootstrap inputs are invalid.'
    )
  }

  const random = createRandom(seed)
  const statistics = Array.from({ length: replicates }, () => {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(random() * values.length)]!
    )
    return Math.abs(mean(sample))
  }).sort((left, right) => left - right)

  return percentile(statistics, 0.05)
}

export function rate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator
}

export function mean(values: readonly number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

export function rootMeanSquare(values: readonly number[]) {
  return Math.sqrt(mean(values.map((value) => value * value)))
}

export function percentile(sortedValues: readonly number[], quantile: number) {
  if (sortedValues.length === 0) return 0
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new TypeError('Percentile quantiles must be between zero and one.')
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(quantile * sortedValues.length) - 1)
  )
  return sortedValues[index]!
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}
