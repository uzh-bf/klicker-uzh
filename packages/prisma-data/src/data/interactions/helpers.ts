// Shared utilities for the interaction-seeding generators: a deterministic
// PRNG, a semester-shaped timestamp sampler, and participant-profile
// assignment. All randomness goes through the single `Rng` instance so a
// given seed produces an identical dataset across runs.

export type Rng = {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T
  shuffle<T>(items: readonly T[]): T[]
  bool(probability: number): boolean
}

// Mulberry32 — 32-bit seeded PRNG. Tiny, fast, identical output across
// Node + modern browsers. Not cryptographically strong; we only need
// reproducibility.
export function makeRng(seedString: string): Rng {
  let state = hashSeed(seedString)

  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick called with empty array')
      return items[Math.floor(next() * items.length)]!
    },
    weightedPick(items, weights) {
      if (items.length === 0) throw new Error('weightedPick with empty array')
      if (items.length !== weights.length) {
        throw new Error('weightedPick: items and weights length mismatch')
      }
      const total = weights.reduce((acc, w) => acc + w, 0)
      let target = next() * total
      for (let i = 0; i < items.length; i++) {
        target -= weights[i]!
        if (target <= 0) return items[i]!
      }
      return items[items.length - 1]!
    },
    shuffle(items) {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
    bool(probability) {
      return next() < probability
    },
  }
}

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------------- Calendar sampler ----------------

// Semester-shaped activity weights. Dates span Sep 2025 → Apr 2026 to match
// the current calendar (2026-04-19). Each bucket is inclusive on both ends.
type CalendarBucket = { start: string; end: string; weight: number }

const DEFAULT_BUCKETS: CalendarBucket[] = [
  { start: '2025-09-15', end: '2025-10-15', weight: 0.2 },
  { start: '2025-10-16', end: '2025-11-30', weight: 0.35 },
  { start: '2025-12-01', end: '2025-12-20', weight: 0.15 },
  { start: '2025-12-21', end: '2026-02-15', weight: 0.05 },
  { start: '2026-02-16', end: '2026-03-31', weight: 0.15 },
  { start: '2026-04-01', end: '2026-04-18', weight: 0.1 },
]

export type Calendar = {
  sample(rng: Rng): Date
  windowStart: Date
  windowEnd: Date
}

export function makeCalendar(
  buckets: CalendarBucket[] = DEFAULT_BUCKETS
): Calendar {
  const parsed = buckets.map((b) => ({
    startMs: Date.parse(`${b.start}T00:00:00Z`),
    endMs: Date.parse(`${b.end}T23:59:59Z`),
    weight: b.weight,
  }))
  const windowStart = new Date(Math.min(...parsed.map((p) => p.startMs)))
  const windowEnd = new Date(Math.max(...parsed.map((p) => p.endMs)))

  return {
    windowStart,
    windowEnd,
    sample(rng) {
      const bucket = rng.weightedPick(
        parsed,
        parsed.map((p) => p.weight)
      )
      // Skew toward afternoon hours (13:00 – 21:00 local-ish) by biasing
      // the time-of-day sample. Keeps weekly/monthly rollups realistic.
      const dayMs = bucket.endMs - bucket.startMs
      const dayOffset = rng.next() * dayMs
      const candidate = new Date(bucket.startMs + dayOffset)
      candidate.setUTCHours(
        10 + Math.floor(rng.next() * 11),
        rng.int(0, 59),
        rng.int(0, 59),
        0
      )
      return candidate
    },
  }
}

// ---------------- Participant profiles ----------------

export type ActivityProfile = 'heavy' | 'medium' | 'light' | 'dormant'

// Weights sum to 1; 10% heavy / 30% medium / 40% light / 20% dormant.
const PROFILE_WEIGHTS: Record<ActivityProfile, number> = {
  heavy: 0.1,
  medium: 0.3,
  light: 0.4,
  dormant: 0.2,
}

export type ProfileBudget = {
  profile: ActivityProfile
  // ability ∈ [0, 1]. Higher = more likely to answer correctly.
  ability: number
  responsesTarget: number
  chatMessagesTarget: number
}

export function assignProfiles(
  participantIds: readonly string[],
  rng: Rng
): Map<string, ProfileBudget> {
  const profileOrder: ActivityProfile[] = [
    'heavy',
    'medium',
    'light',
    'dormant',
  ]
  const profileWeights = profileOrder.map((p) => PROFILE_WEIGHTS[p])
  const budget: Record<
    ActivityProfile,
    {
      responses: [number, number]
      chat: [number, number]
      ability: [number, number]
    }
  > = {
    heavy: { responses: [80, 150], chat: [30, 60], ability: [0.7, 0.95] },
    medium: { responses: [25, 70], chat: [5, 20], ability: [0.5, 0.8] },
    light: { responses: [5, 20], chat: [0, 5], ability: [0.3, 0.65] },
    dormant: { responses: [0, 0], chat: [0, 0], ability: [0.0, 0.5] },
  }

  const map = new Map<string, ProfileBudget>()
  for (const id of participantIds) {
    const profile = rng.weightedPick(profileOrder, profileWeights)
    const b = budget[profile]
    map.set(id, {
      profile,
      ability: b.ability[0] + rng.next() * (b.ability[1] - b.ability[0]),
      responsesTarget: rng.int(b.responses[0], b.responses[1]),
      chatMessagesTarget: rng.int(b.chat[0], b.chat[1]),
    })
  }
  return map
}

// ---------------- Element difficulty ----------------

// Each element instance gets a difficulty in [0, 1]. Paired with the
// participant's ability, the probability of a CORRECT response is:
//     P(correct) = clamp(ability - difficulty + 0.5, 0.05, 0.98)
// That produces a realistic interaction: easy questions become near-always
// right, hard questions become near-always wrong, and mid questions sort by
// ability.
export function assignDifficulty(
  instanceIds: readonly number[],
  rng: Rng
): Map<number, number> {
  const map = new Map<number, number>()
  for (const id of instanceIds) {
    // Beta(2, 2)-ish shape: bias toward the middle, rare extremes.
    const raw = (rng.next() + rng.next() + rng.next()) / 3
    map.set(id, raw)
  }
  return map
}

export function correctnessProbability(
  ability: number,
  difficulty: number
): number {
  const raw = ability - difficulty + 0.5
  if (raw < 0.05) return 0.05
  if (raw > 0.98) return 0.98
  return raw
}

// ---------------- Timestamp ordering ----------------

// Given N timestamps sampled from the calendar, returns them sorted ascending.
// Useful where we want a participant's response history to progress through
// time monotonically (so first-vs-last-response analytics read naturally).
export function sortedTimestamps(
  count: number,
  calendar: Calendar,
  rng: Rng
): Date[] {
  const out: Date[] = []
  for (let i = 0; i < count; i++) out.push(calendar.sample(rng))
  out.sort((a, b) => a.getTime() - b.getTime())
  return out
}
