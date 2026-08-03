import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type ReferenceItem = {
  id: string
  itemType: 'NUMERICAL' | 'SC' | 'MC' | 'KPRIM' | 'FREE_TEXT'
  choiceCount: number | null
  model: 'TWO_PL' | 'THREE_PL_FIXED_C'
  calibrationId: string
  discrimination: number
  difficulty: number
  guessing: number
}

type ReferenceResponse = {
  item: ReferenceItem
  correct: boolean
}

type ReferenceScale = {
  priorMean: number
  priorStandardDeviation: number
  gridMin: number
  gridMax: number
  gridStep: number
  cuts: number[]
}

const scale: ReferenceScale = {
  priorMean: 0,
  priorStandardDeviation: 1,
  gridMin: -6,
  gridMax: 6,
  gridStep: 0.1,
  cuts: [-1.5, 1.5],
}
const credibleMass = 0.9
const scenarios = [
  { id: 'prior-only', responses: [] },
  {
    id: 'mixed-2pl-3pl',
    responses: [
      response('numerical', 'NUMERICAL', null, 1.1, -0.5, 0, true),
      response('sc', 'SC', 4, 1.4, 0, 0.25, false),
      response('mc', 'MC', 4, 0.9, 0.6, 1 / 15, true),
      response('kprim', 'KPRIM', 4, 1.3, -1, 1 / 16, false),
      response('free-text', 'FREE_TEXT', null, 0.8, 1.2, 0, true),
    ],
  },
  {
    id: 'asymmetric-parameters',
    responses: [
      response('asym-1', 'NUMERICAL', null, 0.55, -2.4, 0, true),
      response('asym-2', 'SC', 5, 2.1, -0.2, 0.2, true),
      response('asym-3', 'MC', 3, 1.7, 1.8, 1 / 7, false),
      response('asym-4', 'FREE_TEXT', null, 1.05, 2.7, 0, false),
    ],
  },
  {
    id: 'extreme-correct',
    responses: Array.from({ length: 24 }, (_, index) =>
      response(
        `correct-${index}`,
        index % 2 === 0 ? 'NUMERICAL' : 'SC',
        index % 2 === 0 ? null : 4,
        1.2 + (index % 3) * 0.1,
        -3 + (index % 7),
        index % 2 === 0 ? 0 : 0.25,
        true
      )
    ),
  },
  {
    id: 'extreme-wrong',
    responses: Array.from({ length: 24 }, (_, index) =>
      response(
        `wrong-${index}`,
        index % 2 === 0 ? 'FREE_TEXT' : 'KPRIM',
        index % 2 === 0 ? null : 4,
        1.15 + (index % 4) * 0.1,
        -3 + (index % 7),
        index % 2 === 0 ? 0 : 1 / 16,
        false
      )
    ),
  },
  {
    id: 'cut-boundary',
    responses: [
      response('cut-1', 'NUMERICAL', null, 1.5, 1.5, 0, true),
      response('cut-2', 'NUMERICAL', null, 1.5, 1.5, 0, false),
      response('cut-3', 'SC', 4, 1.2, 1.5, 0.25, true),
      response('cut-4', 'SC', 4, 1.2, 1.5, 0.25, false),
    ],
  },
] satisfies Array<{ id: string; responses: ReferenceResponse[] }>

const cases = scenarios.map((scenario) => ({
  id: scenario.id,
  input: {
    responses: scenario.responses,
  },
  output: computeReference(scenario.responses),
}))
const fixture = {
  schemaVersion: 1,
  scale,
  credibleMass,
  cases,
}
const fixtureUrl = new URL(
  '../test/fixtures/eap-reference.json',
  import.meta.url
)
const provenanceUrl = new URL(
  '../test/fixtures/eap-reference-provenance.md',
  import.meta.url
)
writeFileSync(fixtureUrl, `${JSON.stringify(fixture, null, 2)}\n`)
formatGeneratedFile(fixtureUrl)

const generatorSha256 = sha256(readFileSync(new URL(import.meta.url)))
const fixtureText = readFileSync(fixtureUrl, 'utf8')
const fixtureSha256 = sha256(fixtureText)
writeFileSync(
  provenanceUrl,
  `# EAP Reference Fixture Provenance

- Generator: \`packages/adaptive-learning/scripts/generateEapReference.ts\`
- Command: \`pnpm --filter @klicker-uzh/adaptive-learning generate:eap-reference\`
- Node: \`${process.version}\` (repository pin: \`24.16.0\`)
- pnpm: \`11.5.0\`
- Discrete domain: \`[-6, 6]\`, step \`0.1\`, both endpoints included
- Continuous domain: \`[-6, 6]\`
- Continuous method: adaptive Simpson quadrature, absolute tolerance \`1e-11\`, maximum depth \`24\`
- Discrete comparison tolerance: mean/SD \`1e-10\`
- Continuous comparison tolerance: mean/SD \`0.02\`
- Fixture SHA-256: \`${fixtureSha256}\`
- Generator SHA-256: \`${generatorSha256}\`

The generator imports no adaptive-learning production module. It independently
implements the normal prior, stable 2PL/fixed-c 3PL Bernoulli log likelihood,
discrete normalization, equal-tail quantiles, exact-cut atom splitting, and
continuous moment integration. CI reads and verifies this frozen evidence; it
  does not regenerate it implicitly.
`
)
formatGeneratedFile(provenanceUrl)

function computeReference(responses: ReferenceResponse[]) {
  const points = gridPoints(scale)
  const logMasses = points.map((theta) => logPosterior(theta, responses))
  const shift = Math.max(...logMasses)
  const rawMasses = logMasses.map((value) => Math.exp(value - shift))
  const total = sum(rawMasses)
  const probabilities = rawMasses.map((value) => value / total)
  const discreteMean = weightedMoment(points, probabilities, 1)
  const discreteSecond = weightedMoment(points, probabilities, 2)
  const tail = (1 - credibleMass) / 2

  const density = (theta: number) =>
    Math.exp(logPosterior(theta, responses) - shift)
  const continuousTotal = adaptiveSimpson(density, scale.gridMin, scale.gridMax)
  const continuousMean =
    adaptiveSimpson(
      (theta) => theta * density(theta),
      scale.gridMin,
      scale.gridMax
    ) / continuousTotal
  const continuousSecond =
    adaptiveSimpson(
      (theta) => theta * theta * density(theta),
      scale.gridMin,
      scale.gridMax
    ) / continuousTotal

  return {
    discrete: {
      mean: discreteMean,
      standardDeviation: Math.sqrt(
        Math.max(0, discreteSecond - discreteMean * discreteMean)
      ),
      credibleLower: quantile(points, probabilities, tail),
      credibleUpper: quantile(points, probabilities, 1 - tail),
      bandProbabilities: bandProbabilities(points, probabilities, scale.cuts),
    },
    continuous: {
      mean: continuousMean,
      standardDeviation: Math.sqrt(
        Math.max(0, continuousSecond - continuousMean * continuousMean)
      ),
    },
  }
}

function response(
  id: string,
  itemType: ReferenceItem['itemType'],
  choiceCount: number | null,
  discrimination: number,
  difficulty: number,
  guessing: number,
  correct: boolean
): ReferenceResponse {
  return {
    item: {
      id,
      itemType,
      choiceCount,
      model:
        itemType === 'NUMERICAL' || itemType === 'FREE_TEXT'
          ? 'TWO_PL'
          : 'THREE_PL_FIXED_C',
      calibrationId: `calibration-${id}`,
      discrimination,
      difficulty,
      guessing,
    },
    correct,
  }
}

function gridPoints(definition: ReferenceScale) {
  const intervals = Math.round(
    (definition.gridMax - definition.gridMin) / definition.gridStep
  )
  return Array.from({ length: intervals + 1 }, (_, index) =>
    index === intervals
      ? definition.gridMax
      : definition.gridMin + index * definition.gridStep
  )
}

function logPosterior(theta: number, responses: ReferenceResponse[]) {
  const standardized = (theta - scale.priorMean) / scale.priorStandardDeviation
  return (
    -0.5 * standardized * standardized +
    responses.reduce((total, current) => total + logResponse(theta, current), 0)
  )
}

function logResponse(theta: number, current: ReferenceResponse) {
  const { discrimination, difficulty, guessing } = current.item
  const predictor = discrimination * (theta - difficulty)
  if (current.correct) {
    const logistic = logSigmoid(predictor)
    return guessing === 0
      ? logistic
      : logAddExp(Math.log(guessing), Math.log1p(-guessing) + logistic)
  }
  return Math.log1p(-guessing) + logSigmoid(-predictor)
}

function bandProbabilities(
  points: number[],
  probabilities: number[],
  cuts: number[]
) {
  const bands = Array<number>(cuts.length + 1).fill(0)
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!
    const mass = probabilities[index]!
    const cutIndex = cuts.findIndex((cut) => approximatelyEqual(point, cut))
    if (cutIndex >= 0) {
      bands[cutIndex] = bands[cutIndex]! + mass / 2
      bands[cutIndex + 1] = bands[cutIndex + 1]! + mass / 2
    } else {
      const band = cuts.findIndex((cut) => point < cut)
      const bandIndex = band === -1 ? cuts.length : band
      bands[bandIndex] = bands[bandIndex]! + mass
    }
  }
  return bands
}

function weightedMoment(
  points: number[],
  probabilities: number[],
  power: number
) {
  return points.reduce(
    (total, point, index) => total + point ** power * probabilities[index]!,
    0
  )
}

function quantile(points: number[], probabilities: number[], target: number) {
  let cumulative = 0
  for (let index = 0; index < points.length; index++) {
    cumulative += probabilities[index]!
    if (cumulative + 1e-12 >= target) return points[index]!
  }
  return points.at(-1)!
}

function adaptiveSimpson(
  fn: (value: number) => number,
  lower: number,
  upper: number,
  tolerance = 1e-11,
  maximumDepth = 24
) {
  const midpoint = (lower + upper) / 2
  const lowerValue = fn(lower)
  const midpointValue = fn(midpoint)
  const upperValue = fn(upper)
  const whole = simpson(lower, upper, lowerValue, midpointValue, upperValue)
  return refineSimpson(
    fn,
    lower,
    upper,
    lowerValue,
    midpointValue,
    upperValue,
    whole,
    tolerance,
    maximumDepth
  )
}

function refineSimpson(
  fn: (value: number) => number,
  lower: number,
  upper: number,
  lowerValue: number,
  midpointValue: number,
  upperValue: number,
  whole: number,
  tolerance: number,
  depth: number
): number {
  const midpoint = (lower + upper) / 2
  const leftMidpoint = (lower + midpoint) / 2
  const rightMidpoint = (midpoint + upper) / 2
  const leftMidpointValue = fn(leftMidpoint)
  const rightMidpointValue = fn(rightMidpoint)
  const left = simpson(
    lower,
    midpoint,
    lowerValue,
    leftMidpointValue,
    midpointValue
  )
  const right = simpson(
    midpoint,
    upper,
    midpointValue,
    rightMidpointValue,
    upperValue
  )
  const delta = left + right - whole
  if (depth <= 0 || Math.abs(delta) <= 15 * tolerance) {
    return left + right + delta / 15
  }
  return (
    refineSimpson(
      fn,
      lower,
      midpoint,
      lowerValue,
      leftMidpointValue,
      midpointValue,
      left,
      tolerance / 2,
      depth - 1
    ) +
    refineSimpson(
      fn,
      midpoint,
      upper,
      midpointValue,
      rightMidpointValue,
      upperValue,
      right,
      tolerance / 2,
      depth - 1
    )
  )
}

function simpson(
  lower: number,
  upper: number,
  lowerValue: number,
  midpointValue: number,
  upperValue: number
) {
  return ((upper - lower) / 6) * (lowerValue + 4 * midpointValue + upperValue)
}

function logSigmoid(value: number) {
  return value >= 0
    ? -Math.log1p(Math.exp(-value))
    : value - Math.log1p(Math.exp(value))
}

function logAddExp(left: number, right: number) {
  const maximum = Math.max(left, right)
  return (
    maximum + Math.log(Math.exp(left - maximum) + Math.exp(right - maximum))
  )
}

function approximatelyEqual(left: number, right: number) {
  return (
    Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 16
  )
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function formatGeneratedFile(url: URL) {
  execFileSync('pnpm', ['exec', 'prettier', '--write', fileURLToPath(url)], {
    stdio: 'ignore',
  })
}
