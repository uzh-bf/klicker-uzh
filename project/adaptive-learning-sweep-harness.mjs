// Sweep v2 — corrected ground truth + final-estimator and competence-level stop variants.
// Fixes over sweep.mjs:
//  1. True thetas ~ Uniform over [min - gap/2, max + gap/2]; true level defined under the
//     semantics being evaluated (nearest-anchor bands vs mastery/floor bands), so neither
//     mapping rule is artificially favored.
//  2. finalEstimator: routing always uses MAP prior (SD 1) for stability; the FINAL estimate
//     can use the same prior, a weak prior (SD 2), or plain MLE.
//  3. stopLevel 'competence': stop when the pooled competence estimate reaches SE threshold
//     or its CI sits inside one level band (z=1.28), with a min-items floor per subcompetence
//     for content balance; per-subcompetence cap still applies.
import {
  aggregateWeightedEstimates,
  deriveGuessingParameter,
  mapLevelsToTheta,
  selectNextItem,
  selectSubCompetence,
  updateTheta,
} from '../packages/adaptive-learning/dist/index.js'
import { writeFileSync } from 'node:fs'

const RANGE = { min: -3, max: 3 }
const SECONDS_PER_ITEM = 30

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function makeLevels(count) {
  const labels =
    count === 6
      ? ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      : Array.from({ length: count }, (_, i) => `L${i + 1}`)
  return labels.map((label, order) => ({ label, order }))
}

function itemParams(itemType) {
  if (itemType === 'SC4') return { type: 'SC', choiceCount: 4 }
  if (itemType === 'KPRIM') return { type: 'KPRIM', choiceCount: 4 }
  return { type: 'FREE_TEXT', choiceCount: undefined }
}

function buildPool(cfg, mapped, rng) {
  const { type, choiceCount } = itemParams(cfg.itemType)
  const c = deriveGuessingParameter({ type, choiceCount })
  const pool = []
  for (let comp = 0; comp < cfg.C; comp++) {
    for (let sub = 0; sub < cfg.S; sub++) {
      for (let lvl = 0; lvl < mapped.length; lvl++) {
        for (let i = 0; i < cfg.itemsPerLevel; i++) {
          let trueLvl = lvl
          if (cfg.misLevelProb > 0 && rng() < cfg.misLevelProb) {
            const shift = rng() < 0.5 ? -1 : 1
            trueLvl = Math.min(mapped.length - 1, Math.max(0, lvl + shift))
          }
          pool.push({
            id: `${comp}-${sub}-${lvl}-${i}`,
            type,
            a: cfg.a,
            b: mapped[lvl].theta,
            c,
            choiceCount,
            comp,
            sub,
            lvl,
            trueB: mapped[trueLvl].theta,
            trueA: cfg.trueA ?? cfg.a,
          })
        }
      }
    }
  }
  return pool
}

function generateResponse(item, thetaTrue, rng) {
  const p = item.c + (1 - item.c) / (1 + Math.exp(-item.trueA * (thetaTrue - item.trueB)))
  return rng() < p
}

function mapFloor(theta, mapped) {
  let level = mapped[0]
  for (const entry of mapped) if (entry.theta <= theta + 1e-9) level = entry
  return level
}

function mapNearest(theta, mapped) {
  let best = mapped[0]
  for (const entry of mapped)
    if (Math.abs(entry.theta - theta) < Math.abs(best.theta - theta)) best = entry
  return best
}

function trueLevelUnder(semantics, theta, mapped) {
  return semantics === 'floor' ? mapFloor(theta, mapped) : mapNearest(theta, mapped)
}

function estimateWith(responses, { usePrior, priorMean, priorSD }) {
  return updateTheta({
    responses,
    range: RANGE,
    initialTheta: usePrior ? priorMean : 0,
    usePrior,
    priorMean,
    priorSD,
  })
}

function simulateLearner(cfg, pool, mapped, thetaTrue, rng) {
  const answered = new Set()
  const bySub = new Map()
  const byComp = new Map()
  const stopReason = new Map()
  const compStopReason = new Map()
  const subKey = (c, s) => `${c}-${s}`
  for (let c = 0; c < cfg.C; c++) {
    byComp.set(c, [])
    for (let s = 0; s < cfg.S; s++) bySub.set(subKey(c, s), [])
  }

  const remainingCoverage = (c, s) =>
    new Set(
      pool.filter((it) => it.comp === c && it.sub === s && !answered.has(it.id)).map((it) => it.lvl)
    ).size

  const routingPrior = cfg.routingPrior !== false
  const routing = { usePrior: routingPrior, priorMean: 0, priorSD: 1 }
  const compEstimate = (c) => estimateWith(byComp.get(c), routing)
  const subState = (c, s) =>
    estimateWith(bySub.get(subKey(c, s)), {
      usePrior: routingPrior,
      priorMean: cfg.subPriorFromCompetence && byComp.get(c).length > 0 ? compEstimate(c).theta : 0,
      priorSD: 1,
    })

  const competenceCriterionMet = (c) => {
    if (compStopReason.has(c)) return true
    const responses = byComp.get(c)
    if (responses.length === 0) return false
    const state = compEstimate(c)
    if (state.standardError <= cfg.seThreshold) {
      compStopReason.set(c, 'se')
      return true
    }
    if (
      cfg.classStop &&
      Number.isFinite(state.standardError) &&
      trueLevelUnder(cfg.mapping, state.theta - 1.28 * state.standardError, mapped).order ===
        trueLevelUnder(cfg.mapping, state.theta + 1.28 * state.standardError, mapped).order
    ) {
      compStopReason.set(c, 'class')
      return true
    }
    return false
  }

  const isSubStopped = (c, s) => {
    const key = subKey(c, s)
    if (stopReason.has(key)) return true
    const responses = bySub.get(key)
    const remember = (reason) => {
      stopReason.set(key, reason)
      return true
    }
    if (responses.length >= cfg.cap) return remember('cap')
    if (remainingCoverage(c, s) === 0) return remember('coverage')
    if (cfg.stopLevel === 'competence') {
      if (responses.length >= (cfg.minPerSub ?? 2) && competenceCriterionMet(c))
        return remember(compStopReason.get(c))
      return false
    }
    if (responses.length > 0) {
      const state = subState(c, s)
      if (state.standardError <= cfg.seThreshold) return remember('se')
    }
    return false
  }

  let total = 0
  const hardCap = cfg.C * cfg.S * cfg.cap + 5
  while (total < hardCap) {
    let selected = null
    for (let c = 0; c < cfg.C && !selected; c++) {
      const candidates = []
      for (let s = 0; s < cfg.S; s++) {
        const stopped = isSubStopped(c, s)
        candidates.push({
          competenceId: String(c),
          subCompetenceId: String(s),
          enabled: !stopped,
          stopped,
          answeredQuestions: bySub.get(subKey(c, s)).length,
          questionThreshold: cfg.cap,
          coverage: remainingCoverage(c, s),
        })
      }
      const pick = selectSubCompetence({ candidates, random: rng })
      if (!pick) continue
      const s = Number(pick.subCompetenceId)
      const theta = subState(c, s).theta
      const items = pool.filter((it) => it.comp === c && it.sub === s)
      const item = selectNextItem({ theta, items, answeredItemIds: answered, random: rng })
      if (item) selected = item
    }
    if (!selected) break

    const correct = generateResponse(selected, thetaTrue, rng)
    answered.add(selected.id)
    const response = { item: selected, correct }
    bySub.get(subKey(selected.comp, selected.sub)).push(response)
    byComp.get(selected.comp).push(response)
    total += 1
  }

  const finalParams =
    cfg.finalEstimator === 'mle'
      ? { usePrior: false, priorMean: 0, priorSD: 1 }
      : cfg.finalEstimator === 'weak'
        ? { usePrior: true, priorMean: 0, priorSD: 2 }
        : { usePrior: true, priorMean: 0, priorSD: 1 }
  const compEstimates = []
  for (let c = 0; c < cfg.C; c++) {
    if (byComp.get(c).length === 0) continue
    const state = estimateWith(byComp.get(c), finalParams)
    compEstimates.push({ theta: state.theta, standardError: state.standardError, weight: 1 })
  }
  const aggregate = aggregateWeightedEstimates(compEstimates) ?? {
    theta: 0,
    standardError: Infinity,
  }
  const level = trueLevelUnder(cfg.mapping, aggregate.theta, mapped)
  const reasons = { cap: 0, se: 0, coverage: 0, class: 0 }
  for (const reason of stopReason.values()) reasons[reason] += 1

  return {
    theta: aggregate.theta,
    se: aggregate.standardError,
    level: level.order,
    length: total,
    reasons,
  }
}

function runConfig(cfg) {
  const levels = makeLevels(cfg.levels)
  const mapped = mapLevelsToTheta(levels, RANGE)
  const gap = mapped.length > 1 ? mapped[1].theta - mapped[0].theta : 1
  const lo = RANGE.min - gap / 2
  const hi = RANGE.max + gap / 2
  const results = []
  for (let learner = 0; learner < cfg.learners; learner++) {
    const rng = mulberry32(700_000 + learner * 104729)
    const thetaTrue = lo + (hi - lo) * rng()
    const expected = trueLevelUnder(cfg.gtSemantics ?? cfg.mapping, thetaTrue, mapped).order
    const pool = buildPool(cfg, mapped, rng)
    const res = simulateLearner(cfg, pool, mapped, thetaTrue, rng)
    results.push({ expected, ...res })
  }
  const n = results.length
  const exact = results.filter((r) => r.level === r.expected).length / n
  const adjacent = results.filter((r) => Math.abs(r.level - r.expected) <= 1).length / n
  const mae = results.reduce((sum, r) => sum + Math.abs(r.level - r.expected), 0) / n
  const lengths = results.map((r) => r.length).sort((a, b) => a - b)
  const meanLen = lengths.reduce((a, b) => a + b, 0) / n
  const medLen = lengths[Math.floor(n / 2)]
  const p90Len = lengths[Math.floor(n * 0.9)]
  const meanSE = results.reduce((s, r) => s + (Number.isFinite(r.se) ? r.se : 0), 0) / n
  const reasons = { cap: 0, se: 0, coverage: 0, class: 0 }
  for (const r of results) for (const k of Object.keys(reasons)) reasons[k] += r.reasons[k]
  const reasonTotal = Object.values(reasons).reduce((a, b) => a + b, 0) || 1
  return {
    exact,
    adjacent,
    mae,
    meanLen,
    medLen,
    p90Len,
    meanMin: (meanLen * SECONDS_PER_ITEM) / 60,
    p90Min: (p90Len * SECONDS_PER_ITEM) / 60,
    meanSE,
    stopSharePct: Object.fromEntries(
      Object.entries(reasons).map(([k, v]) => [k, Math.round((100 * v) / reasonTotal)])
    ),
  }
}

const BASE = {
  levels: 6,
  C: 3,
  S: 3,
  itemsPerLevel: 5,
  itemType: 'SC4',
  a: 1.5,
  trueA: null,
  seThreshold: 0.55,
  cap: 8,
  minPerSub: 2,
  subPriorFromCompetence: true,
  finalEstimator: 'weak',
  mapping: 'nearest',
  gtSemantics: null, // defaults to mapping (self-consistent)
  misLevelProb: 0,
  stopLevel: 'sub',
  classStop: false,
  learners: 300,
}

function fmt(x, digits = 2) {
  return typeof x === 'number' ? x.toFixed(digits) : String(x)
}

const allResults = []
function runStage(name, variants) {
  console.log(`\n=== ${name} ===`)
  console.log(
    'label'.padEnd(56) +
      ['exact', 'adj', 'MAE', 'meanLen', 'p90Len', 'meanMin', 'meanSE', ' cap/se/cov/cls']
        .map((h) => h.padStart(9))
        .join(' ')
  )
  for (const { label, ...overrides } of variants) {
    const cfg = { ...BASE, ...overrides }
    const r = runConfig(cfg)
    allResults.push({ stage: name, label, cfg, ...r })
    const s = r.stopSharePct
    console.log(
      label.padEnd(56) +
        [
          fmt(r.exact),
          fmt(r.adjacent),
          fmt(r.mae),
          fmt(r.meanLen, 1),
          fmt(r.p90Len, 0),
          fmt(r.meanMin, 1),
          fmt(r.meanSE),
          `${s.cap}/${s.se}/${s.coverage}/${s.class}`,
        ]
          .map((v) => String(v).padStart(9))
          .join(' ')
    )
  }
}

// A2: mapping semantics — self-consistent and crossed (quantifies the half-level shift)
runStage('A2: mapping vs ground-truth semantics (3x3, cap 8, final=weak)', [
  { label: 'map=nearest GT=nearest (self-consistent)', mapping: 'nearest' },
  { label: 'map=floor   GT=floor   (self-consistent)', mapping: 'floor' },
  { label: 'map=nearest GT=floor   (crossed)', mapping: 'nearest', gtSemantics: 'floor' },
  { label: 'map=floor   GT=nearest (crossed)', mapping: 'floor', gtSemantics: 'nearest' },
])

// B2: final estimator (routing prior fixed at SD1)
runStage('B2: final estimator (3x3, cap 8, map=nearest, GT=nearest)', [
  { label: 'final=strong prior (SD1) — proposed B1 fix as-is', finalEstimator: 'strong' },
  { label: 'final=weak prior (SD2)', finalEstimator: 'weak' },
  { label: 'final=MLE (no prior)', finalEstimator: 'mle' },
])

// C2: stop level + classification stop (length savings at equal accuracy)
runStage('C2: stop architecture (3x3, map=nearest, final=weak, a=1.5)', [
  { label: 'sub-level SE stop 0.55 (production shape)', stopLevel: 'sub', seThreshold: 0.55 },
  { label: 'competence-level SE stop 0.40', stopLevel: 'competence', seThreshold: 0.4 },
  { label: 'competence-level SE stop 0.35', stopLevel: 'competence', seThreshold: 0.35 },
  { label: 'competence-level SE stop 0.30', stopLevel: 'competence', seThreshold: 0.3 },
  { label: 'competence SE 0.35 + class stop', stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'competence SE 0.30 + class stop', stopLevel: 'competence', seThreshold: 0.3, classStop: true },
  { label: 'competence class stop only (SE 0.01)', stopLevel: 'competence', seThreshold: 0.01, classStop: true },
])

// D2: 30-minute feasibility across structures (competence-level SE 0.35 + class)
const feas = []
for (const [C, S, cap] of [
  [2, 2, 10],
  [3, 2, 10],
  [3, 3, 8],
  [4, 3, 8],
  [4, 5, 6],
]) {
  feas.push({
    label: `C=${C} S=${S} cap=${cap} (comp SE .35 + class)`,
    C,
    S,
    cap,
    stopLevel: 'competence',
    seThreshold: 0.35,
    classStop: true,
  })
}
runStage('D2: 30-min feasibility (map=nearest, final=weak, a=1.5, 30s/item)', feas)

// E2: discrimination sweep under corrected setup
runStage('E2: discrimination (3x3 cap 8, comp SE .35 + class, final=weak)', [
  { label: 'a=1.0', a: 1.0, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'a=1.2', a: 1.2, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'a=1.5', a: 1.5, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'a=2.0', a: 2.0, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
])

// F2: misspecification under the recommended config
runStage('F2: misspecification (3x3 cap 8, comp SE .35 + class, final=weak)', [
  { label: 'clean', stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'misLevel=10%', misLevelProb: 0.1, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'misLevel=20%', misLevelProb: 0.2, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'trueA=1.0 (configured 1.5)', trueA: 1.0, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'trueA=1.0 + misLevel=10%', trueA: 1.0, misLevelProb: 0.1, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: 'trueA=0.8 + misLevel=20%', trueA: 0.8, misLevelProb: 0.2, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
])

// G2: level count (generic classification guidance)
runStage('G2: level count (3x3 cap 8, comp SE .35 + class, final=weak)', [
  { label: '3 levels', levels: 3, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: '4 levels', levels: 4, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: '5 levels', levels: 5, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: '6 levels', levels: 6, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
  { label: '8 levels', levels: 8, stopLevel: 'competence', seThreshold: 0.35, classStop: true },
])

// H2: item type / guessing parameter effect on achievable SE and length
runStage('H2: item type (3x3 cap 8, comp SE .35 + class, final=weak)', [
  { label: 'SC 4 choices (c=0.25)', itemType: 'SC4' },
  { label: 'KPRIM (c=1/16)', itemType: 'KPRIM' },
  { label: 'FREE_TEXT (c=0.01)', itemType: 'FT' },
].map((v) => ({ ...v, stopLevel: 'competence', seThreshold: 0.35, classStop: true })))

// I2: current shipped defaults for reference under corrected GT
runStage('I2: shipped manage-UI defaults (cap 5, SE 0.3, a 1.2, prior off route+final)', [
  {
    label: 'UI defaults, sub-level stop, final=mle, map=nearest',
    a: 1.2,
    cap: 5,
    seThreshold: 0.3,
    stopLevel: 'sub',
    finalEstimator: 'mle',
    subPriorFromCompetence: false,
    routingPrior: false,
  },
])

writeFileSync(new URL('./sweep2-results.json', import.meta.url), JSON.stringify(allResults, null, 2))
console.log('\nSaved sweep2-results.json')

// D3: 30-minute feasibility table (competence-level SE 0.35 + classification stop)
const feasibilityRows = []
for (const [C, S, cap, levels] of [
  [2, 2, 10, 6], [2, 3, 8, 6], [3, 2, 8, 6], [3, 2, 10, 6], [3, 3, 6, 6],
  [3, 3, 7, 6], [3, 3, 8, 6], [4, 3, 5, 6], [4, 3, 8, 6],
  [2, 2, 10, 4], [3, 3, 6, 4], [3, 3, 8, 4], [3, 3, 6, 3],
]) {
  feasibilityRows.push({
    label: `C=${C} S=${S} cap=${cap} levels=${levels}`,
    C, S, cap, levels,
    stopLevel: 'competence',
    seThreshold: 0.35,
    classStop: true,
  })
}
runStage('D3: feasibility table (comp SE .35 + class, map=nearest, final=weak, a=1.5, SC4)', feasibilityRows)

writeFileSync(new URL('./sweep-results-full.json', import.meta.url), JSON.stringify(allResults, null, 2))
