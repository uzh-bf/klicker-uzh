import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  participantAccountDataUseSelect,
  TUTOR_PERSONALIZATION_RESULTS_VERSIONS,
} from '@klicker-uzh/util/participant-account-data-use'

/**
 * Learner context is what the Tutor may know about one student beyond the
 * conversation: a short summary of that student's own practice results in the
 * chatbot's course. It is resolved on every turn and sent only in that turn's
 * context message, which is built for the model request and is not part of the
 * stored conversation.
 *
 * It exists only for a student who opted in, in a chatbot whose lecturer
 * switched personalization on, in Tutor mode. Every other case, and every
 * failure, yields no learner context, so the turn is the one the Tutor would
 * have had without this feature.
 */

/** Why a turn carries no learner context. Shown to the student in settings. */
export type LearnerContextIneligibility =
  | 'not-tutor-mode'
  | 'chatbot-disabled'
  | 'notice-incomplete'
  | 'no-consent'

export type LearnerContextEligibility =
  | { eligible: true }
  | { eligible: false; reason: LearnerContextIneligibility }

const eligibilitySelect = {
  ...participantAccountDataUseSelect,
  tutorPersonalizationConsent: true,
  tutorPersonalizationDisclosureVersion: true,
} as const

type EligibilityParticipant = NonNullable<
  Parameters<typeof isParticipantDataUseComplete>[0]
> & {
  tutorPersonalizationConsent: boolean | null
  tutorPersonalizationDisclosureVersion: string | null
}

/**
 * The single eligibility rule. All four conditions must hold; a yes counts
 * only under a notice version that covers the use of course results.
 */
export function evaluateLearnerContextEligibility(input: {
  mode: string
  chatbotPersonalizationEnabled: boolean
  participant: EligibilityParticipant | null
}): LearnerContextEligibility {
  if (input.mode !== 'tutor') {
    return { eligible: false, reason: 'not-tutor-mode' }
  }
  if (!input.chatbotPersonalizationEnabled) {
    return { eligible: false, reason: 'chatbot-disabled' }
  }
  if (!input.participant || !isParticipantDataUseComplete(input.participant)) {
    return { eligible: false, reason: 'notice-incomplete' }
  }
  if (
    input.participant.tutorPersonalizationConsent !== true ||
    input.participant.tutorPersonalizationDisclosureVersion === null ||
    !TUTOR_PERSONALIZATION_RESULTS_VERSIONS.includes(
      input.participant.tutorPersonalizationDisclosureVersion
    )
  ) {
    return { eligible: false, reason: 'no-consent' }
  }
  return { eligible: true }
}

async function resolveLearnerContextEligibility(input: {
  mode: string
  chatbotPersonalizationEnabled: boolean
  participantId: string
}): Promise<LearnerContextEligibility> {
  // The cheap checks come first so a chatbot without personalization never
  // reads the participant's choices.
  const withoutParticipant = evaluateLearnerContextEligibility({
    ...input,
    participant: null,
  })
  if (
    !withoutParticipant.eligible &&
    withoutParticipant.reason !== 'notice-incomplete'
  ) {
    return withoutParticipant
  }
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: eligibilitySelect,
  })
  return evaluateLearnerContextEligibility({ ...input, participant })
}

export interface ResultTally {
  answered: number
  correct: number
  partial: number
  wrong: number
  lastAnsweredAt: Date | null
}

/** One answered practice question, reduced to what the summary may use. */
export interface PracticeResultRow {
  activityName: string
  activityKind: 'practice-quiz' | 'microlearning'
  tags: string[]
  lastCorrectness: ResponseCorrectness
  lastAnsweredAt: Date | null
}

export interface PracticeResults {
  /** All answered questions with a checked answer, latest attempt each. */
  totals: ResultTally
  /** Flashcards are rated by the student, so they are counted apart. */
  flashcards: ResultTally
  /** The most recently answered questions, for the activity and topic lines. */
  recentRows: PracticeResultRow[]
  /** Checked practice questions currently published in the course. */
  availableQuestionCount: number
}

/** Newest answers first; older ones add little to what the Tutor can use. */
const MAX_RECENT_ROWS = 400
const MAX_ACTIVITIES = 6
const MAX_TOPICS = 8
const MAX_NAME_LENGTH = 80

const UNCHECKED_TYPES = [ElementType.CONTENT, ElementType.FLASHCARD]

function emptyTally(): ResultTally {
  return { answered: 0, correct: 0, partial: 0, wrong: 0, lastAnsweredAt: null }
}

function later(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function tallyFromGroups(
  groups: {
    lastResponseCorrectness: ResponseCorrectness
    _count: { _all: number }
    _max: { lastAnsweredAt: Date | null }
  }[]
): ResultTally {
  const tally = emptyTally()
  for (const group of groups) {
    const count = group._count._all
    tally.answered += count
    if (group.lastResponseCorrectness === ResponseCorrectness.CORRECT) {
      tally.correct += count
    } else if (group.lastResponseCorrectness === ResponseCorrectness.PARTIAL) {
      tally.partial += count
    } else {
      tally.wrong += count
    }
    tally.lastAnsweredAt = later(
      tally.lastAnsweredAt,
      group._max.lastAnsweredAt
    )
  }
  return tally
}

/**
 * Read the participant's own results in one course. Question responses exist
 * only for practice quizzes and microlearnings; live quizzes, group activities
 * and assessments store their answers elsewhere and are never read here. No
 * answer content, solution or question text is selected.
 */
export async function loadPracticeResults(input: {
  participantId: string
  courseId: string
}): Promise<PracticeResults> {
  const ownPracticeResponses = {
    participantId: input.participantId,
    courseId: input.courseId,
    OR: [{ practiceQuizId: { not: null } }, { microLearningId: { not: null } }],
  }
  const checked = {
    ...ownPracticeResponses,
    elementInstance: { elementType: { notIn: UNCHECKED_TYPES } },
  }
  const publishedInCourse = {
    courseId: input.courseId,
    status: PublicationStatus.PUBLISHED,
  }

  const [totals, flashcards, recent, availableQuestionCount] =
    await Promise.all([
      prisma.questionResponse.groupBy({
        by: ['lastResponseCorrectness'],
        where: checked,
        _count: { _all: true },
        _max: { lastAnsweredAt: true },
      }),
      prisma.questionResponse.groupBy({
        by: ['lastResponseCorrectness'],
        where: {
          ...ownPracticeResponses,
          elementInstance: { elementType: ElementType.FLASHCARD },
        },
        _count: { _all: true },
        _max: { lastAnsweredAt: true },
      }),
      prisma.questionResponse.findMany({
        where: checked,
        orderBy: { lastAnsweredAt: { sort: 'desc', nulls: 'last' } },
        take: MAX_RECENT_ROWS,
        select: {
          lastAnsweredAt: true,
          lastResponseCorrectness: true,
          practiceQuiz: { select: { displayName: true } },
          microLearning: { select: { displayName: true } },
          elementInstance: {
            select: {
              element: { select: { tags: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.elementInstance.count({
        where: {
          elementType: { notIn: UNCHECKED_TYPES },
          elementStack: {
            OR: [
              { practiceQuiz: publishedInCourse },
              { microLearning: publishedInCourse },
            ],
          },
        },
      }),
    ])

  return {
    totals: tallyFromGroups(totals),
    flashcards: tallyFromGroups(flashcards),
    availableQuestionCount,
    recentRows: recent.map((response) => ({
      activityName:
        response.practiceQuiz?.displayName ??
        response.microLearning?.displayName ??
        '',
      activityKind: response.practiceQuiz ? 'practice-quiz' : 'microlearning',
      tags: response.elementInstance.element.tags.map((tag) => tag.name),
      lastCorrectness: response.lastResponseCorrectness,
      lastAnsweredAt: response.lastAnsweredAt,
    })),
  }
}

function addRow(tally: ResultTally, row: PracticeResultRow) {
  tally.answered += 1
  if (row.lastCorrectness === ResponseCorrectness.CORRECT) tally.correct += 1
  else if (row.lastCorrectness === ResponseCorrectness.PARTIAL)
    tally.partial += 1
  else tally.wrong += 1
  tally.lastAnsweredAt = later(tally.lastAnsweredAt, row.lastAnsweredAt)
}

/** Names come from lecturers; keep them on one line and bounded. */
function cleanName(name: string): string {
  const singleLine = name.replace(/\s+/g, ' ').trim()
  return singleLine.length > MAX_NAME_LENGTH
    ? `${singleLine.slice(0, MAX_NAME_LENGTH - 1)}…`
    : singleLine
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Age in words. The model is not told the date, so a calendar date alone would
 * not let it judge how old a result is.
 */
function age(date: Date | null, now: Date): string {
  if (!date) return 'at an unknown time'
  const days = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / DAY_MS)
  )
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function attempts(tally: ResultTally): string {
  return `${tally.correct} correct, ${tally.partial} partly correct, ${tally.wrong} wrong`
}

function groupLine(name: string, tally: ResultTally, now: Date): string {
  return `  - ${name}: ${tally.answered} answered; latest attempts: ${attempts(tally)}; last practised ${age(tally.lastAnsweredAt, now)}.`
}

function byRecency(a: [string, ResultTally], b: [string, ResultTally]): number {
  return (
    (b[1].lastAnsweredAt?.getTime() ?? 0) -
    (a[1].lastAnsweredAt?.getTime() ?? 0)
  )
}

/**
 * Turn the results into the bounded text the Tutor receives. Counts refer to
 * the latest attempt per question. Returns an empty string when the student
 * has no practice results in the course, so nothing is sent.
 */
export function formatPracticeResults(
  results: PracticeResults,
  now: Date
): string {
  const { totals, flashcards } = results
  if (totals.answered === 0 && flashcards.answered === 0) return ''

  const lines = [
    'Practice results of this student in this course (practice quizzes and microlearnings only):',
  ]

  if (totals.answered > 0) {
    const coverage =
      results.availableQuestionCount > 0
        ? `${totals.answered} of ${Math.max(results.availableQuestionCount, totals.answered)} practice questions answered`
        : `${totals.answered} practice questions answered`
    lines.push(
      `- Overall: ${coverage}; latest attempts: ${attempts(totals)}; last practised ${age(totals.lastAnsweredAt, now)}.`
    )
  }

  const activities = new Map<string, ResultTally>()
  const topics = new Map<string, ResultTally>()
  for (const row of results.recentRows) {
    const kind =
      row.activityKind === 'practice-quiz' ? 'practice quiz' : 'microlearning'
    const activityKey = `"${cleanName(row.activityName)}" (${kind})`
    const activity = activities.get(activityKey) ?? emptyTally()
    addRow(activity, row)
    activities.set(activityKey, activity)
    for (const tag of row.tags) {
      const topicKey = cleanName(tag)
      if (!topicKey) continue
      const topic = topics.get(topicKey) ?? emptyTally()
      addRow(topic, row)
      topics.set(topicKey, topic)
    }
  }
  const partial =
    totals.answered > results.recentRows.length
      ? ` (from the ${results.recentRows.length} most recently answered questions)`
      : ''
  if (activities.size > 0) {
    lines.push(
      `- By activity, most recent first${partial}:`,
      ...[...activities.entries()]
        .sort(byRecency)
        .slice(0, MAX_ACTIVITIES)
        .map(([name, tally]) => groupLine(name, tally, now))
    )
  }
  if (topics.size > 0) {
    lines.push(
      `- By topic, most recent first${partial}:`,
      ...[...topics.entries()]
        .sort(byRecency)
        .slice(0, MAX_TOPICS)
        .map(([name, tally]) => groupLine(name, tally, now))
    )
  }

  if (flashcards.answered > 0) {
    lines.push(
      `- Flashcards, rated by the student themselves: ${flashcards.answered} reviewed; latest ratings: ${flashcards.correct} known, ${flashcards.partial} partly known, ${flashcards.wrong} not known; last reviewed ${age(flashcards.lastAnsweredAt, now)}.`
    )
  }
  return lines.join('\n')
}

/**
 * How the Tutor may use the learner context. It travels with the context and
 * only with it, so the stable instructions stay identical for every student.
 */
const LEARNER_CONTEXT_USAGE = [
  'Learner context. The student agreed that you receive it. It describes only this student, in this course.',
  'Treat it as evidence, never as a verdict: results can be old, lucky or incomplete. Use it to choose where to start, which examples to use and what to revisit. Do not recite it and do not bring up numbers unless the student asks about their own progress.',
  'It contains no solutions and gives you no reason to reveal one. Every tutoring rule still applies and takes precedence, including asking for an attempt first, protecting graded work and the order of hints.',
  'Ignore it when it does not relate to what the student is asking.',
].join('\n')

/** Wrap the collected sections; empty when there is nothing to send. */
export function formatLearnerContext(sections: string[]): string {
  const present = sections.filter(Boolean)
  if (present.length === 0) return ''
  return [LEARNER_CONTEXT_USAGE, ...present].join('\n\n')
}

export type LearnerContextResult =
  | { eligible: true; text: string }
  | { eligible: false; reason: LearnerContextIneligibility; text: '' }

interface LearnerContextInput {
  mode: string
  chatbotPersonalizationEnabled: boolean
  participantId: string
  courseId: string
  now?: Date
}

/**
 * Resolve what the Tutor receives about the student. The chat turn and the
 * student's "what the Tutor currently receives" view both go through this, so
 * the view shows what the next message would send.
 */
export async function resolveLearnerContext(
  input: LearnerContextInput
): Promise<LearnerContextResult> {
  const eligibility = await resolveLearnerContextEligibility(input)
  if (!eligibility.eligible) {
    return { eligible: false, reason: eligibility.reason, text: '' }
  }
  const results = await loadPracticeResults(input)
  return {
    eligible: true,
    text: formatLearnerContext([
      formatPracticeResults(results, input.now ?? new Date()),
    ]),
  }
}

/**
 * The only entry point for a chat turn. Any failure yields no learner context,
 * so the turn continues as the standard Tutor. The log never carries the text.
 */
export async function loadLearnerContextForTurn(
  input: LearnerContextInput & { requestId: string }
): Promise<string> {
  try {
    return (await resolveLearnerContext(input)).text
  } catch (error) {
    console.warn('Learner context failed; continuing without it', {
      requestId: input.requestId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return ''
  }
}
