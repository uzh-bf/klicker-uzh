export interface LiveQuizRewardEntryEvidence {
  participantId: string | null
  participationId: number | null
  participation?: {
    participantId: string
    courseId: string
  } | null
  courseId: string | null
  coursePointsAwarded: number
  participantXpAwarded: number
  timelineDate: Date | null
  timelinePointsAwarded: number
  timelineXpAwarded: number
  achievementId: number | null
  achievementCountAwarded: number
}

export type ValidatedLiveQuizRewardEntry<
  Entry extends LiveQuizRewardEntryEvidence = LiveQuizRewardEntryEvidence,
> = Entry & { participantId: string }

export type ValidatedCourseRewardEntry<
  Entry extends LiveQuizRewardEntryEvidence = LiveQuizRewardEntryEvidence,
> = ValidatedLiveQuizRewardEntry<Entry> & {
  participationId: number
  courseId: string
}

export type ValidatedTimelineRewardEntry<
  Entry extends LiveQuizRewardEntryEvidence = LiveQuizRewardEntryEvidence,
> = ValidatedCourseRewardEntry<Entry> & { timelineDate: Date }

export type ValidatedAchievementRewardEntry<
  Entry extends LiveQuizRewardEntryEvidence = LiveQuizRewardEntryEvidence,
> = ValidatedLiveQuizRewardEntry<Entry> & { achievementId: number }

export interface ValidatedLiveQuizRewardLedger<
  Entry extends LiveQuizRewardEntryEvidence = LiveQuizRewardEntryEvidence,
> {
  entries: ValidatedLiveQuizRewardEntry<Entry>[]
  participantXpEntries: ValidatedLiveQuizRewardEntry<Entry>[]
  courseEntries: ValidatedCourseRewardEntry<Entry>[]
  timelineEntries: ValidatedTimelineRewardEntry<Entry>[]
  achievementEntries: ValidatedAchievementRewardEntry<Entry>[]
}

function hasNonnegativeDeltas(entry: LiveQuizRewardEntryEvidence): boolean {
  return (
    entry.coursePointsAwarded >= 0 &&
    entry.participantXpAwarded >= 0 &&
    entry.timelinePointsAwarded >= 0 &&
    entry.timelineXpAwarded >= 0 &&
    entry.achievementCountAwarded >= 0
  )
}

export function isValidLiveQuizRewardEntry(
  entry: LiveQuizRewardEntryEvidence
): entry is ValidatedLiveQuizRewardEntry {
  return (
    entry.participantId !== null &&
    (entry.coursePointsAwarded === 0 ||
      (entry.participationId !== null && entry.courseId !== null)) &&
    (entry.timelinePointsAwarded === 0 && entry.timelineXpAwarded === 0
      ? true
      : entry.participationId !== null &&
        entry.courseId !== null &&
        entry.timelineDate !== null) &&
    (entry.achievementCountAwarded === 0 || entry.achievementId !== null) &&
    hasNonnegativeDeltas(entry)
  )
}

export function isValidPersistedLiveQuizRewardEntry(
  entry: LiveQuizRewardEntryEvidence
): boolean {
  return (
    isValidLiveQuizRewardEntry(entry) &&
    (entry.participationId === null ||
      (entry.participation !== null &&
        entry.participation !== undefined &&
        entry.participation.participantId === entry.participantId &&
        entry.participation.courseId === entry.courseId))
  )
}

function hasUniqueParticipants(
  entries: readonly ValidatedLiveQuizRewardEntry[]
): boolean {
  const participantIds = new Set<string>()
  for (const entry of entries) {
    if (participantIds.has(entry.participantId)) {
      return false
    }
    participantIds.add(entry.participantId)
  }
  return true
}

export function validateLiveQuizRewardEntries<
  Entry extends LiveQuizRewardEntryEvidence,
>(
  entries: readonly Entry[],
  {
    persisted,
    uniqueParticipants,
  }: {
    persisted: boolean
    uniqueParticipants: boolean
  }
): ValidatedLiveQuizRewardLedger<Entry> | null {
  const validator = persisted
    ? isValidPersistedLiveQuizRewardEntry
    : isValidLiveQuizRewardEntry
  if (!entries.every(validator)) return null

  const validEntries = entries as ValidatedLiveQuizRewardEntry<Entry>[]
  if (uniqueParticipants && !hasUniqueParticipants(validEntries)) return null

  return {
    entries: validEntries,
    participantXpEntries: validEntries.filter(
      (entry) => entry.participantXpAwarded !== 0
    ),
    courseEntries: validEntries.filter(
      (entry): entry is ValidatedCourseRewardEntry<Entry> =>
        entry.coursePointsAwarded !== 0 &&
        entry.participationId !== null &&
        entry.courseId !== null
    ),
    timelineEntries: validEntries.filter(
      (entry): entry is ValidatedTimelineRewardEntry<Entry> =>
        (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0) &&
        entry.participationId !== null &&
        entry.courseId !== null &&
        entry.timelineDate !== null
    ),
    achievementEntries: validEntries.filter(
      (entry): entry is ValidatedAchievementRewardEntry<Entry> =>
        entry.achievementCountAwarded !== 0 && entry.achievementId !== null
    ),
  }
}

export function hasValidLiveQuizRewardEntries(
  entries: readonly LiveQuizRewardEntryEvidence[],
  options: {
    persisted: boolean
    uniqueParticipants: boolean
  }
): boolean {
  return validateLiveQuizRewardEntries(entries, options) !== null
}
