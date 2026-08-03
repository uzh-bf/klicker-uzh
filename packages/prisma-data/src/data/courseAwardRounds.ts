/**
 * Round registry for the production course-award seed (seedCourseAwards.ts).
 *
 * A "round" is one batch of externally-earned points and badges handed to
 * Klicker from a lecturer workbook. Each round owns its own key, and every
 * artefact it produces is namespaced by that key inside the gitignored
 * `_local/` directory, so no round can ever replay another round's payload.
 *
 * Adding a round for a new event:
 *   1. Add an entry below with the course ID and the achievement IDs it grants.
 *   2. Drop the sanitized payload at `_local/<key>_data.json` (see the shape in
 *      seedCourseAwards.ts). Never commit it — it contains real usernames.
 *   3. Dry-run, review the comparison CSV, then write with DRY_RUN=false.
 *
 * Achievement IDs are verified against `nameEN` before any write, so a wrong ID
 * fails loudly instead of silently granting the wrong badge.
 */

export interface AwardDefinition {
  /** Key used in the payload's `awards` array. */
  key: string
  /** `Achievement.id` in the target database. */
  id: number
  /** `Achievement.nameEN`, asserted before any write to catch ID drift. */
  nameEN: string
}

export interface RoundConfig {
  label: string
  courseId: string
  awards: AwardDefinition[]
  /**
   * Award key derived from full microlearning completion rather than from the
   * workbook, computed by prepareMicrolearningAwards.ts.
   */
  derivedAward?: string
  /** Completed rounds stay here as worked examples; they are replay-locked. */
  completed?: string
}

const SUMMER_SCHOOL_2026_COURSE_ID = '043a156f-c3d4-484a-9b98-bbf7c54b92cc'

export const ROUNDS: Record<string, RoundConfig> = {
  summerschool_portfolio: {
    label: 'Summer School 2026 portfolio game',
    courseId: SUMMER_SCHOOL_2026_COURSE_ID,
    awards: [{ key: 'portfolio', id: 21, nameEN: 'Portfolio Professional' }],
    completed: '2026-07 — 25,700 points, 3 badges',
  },
  summerschool_dtp: {
    label: 'Summer School 2026 DTP game',
    courseId: SUMMER_SCHOOL_2026_COURSE_ID,
    awards: [
      { key: 'creative_mastermind', id: 11, nameEN: 'Creative Mastermind' },
      { key: 'shooting_star', id: 16, nameEN: 'Shooting Star' },
      { key: 'happiness', id: 14, nameEN: 'Happiness' },
      { key: 'busy_bee', id: 3, nameEN: 'Busy Bee' },
    ],
    derivedAward: 'busy_bee',
    completed: '2026-07-21 — 26,200 points, 37 badges across 36 participants',
  },
  summerschool_shootingstar: {
    label: 'Summer School 2026 Shooting Star follow-up',
    courseId: SUMMER_SCHOOL_2026_COURSE_ID,
    awards: [{ key: 'shooting_star', id: 16, nameEN: 'Shooting Star' }],
    completed: '2026-07-21 — badge-only, 3 participants, zero point delta',
  },
}

export function resolveRound(): { key: string; config: RoundConfig } {
  const key = process.env.ROUND
  if (!key) {
    throw new Error(
      `ROUND is required. Available rounds: ${Object.keys(ROUNDS).join(', ')}`
    )
  }

  const config = ROUNDS[key]
  if (!config) {
    throw new Error(
      `Unknown round "${key}". Available rounds: ${Object.keys(ROUNDS).join(', ')}`
    )
  }

  return { key, config }
}

/** Every artefact of a round lives in the gitignored `_local/` directory. */
export function roundFile(key: string, suffix: string): URL {
  return new URL(`_local/${key}_${suffix}`, import.meta.url)
}
