import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'

export function isAdaptiveRetakeCooldownElapsed({
  completedAt,
  cooldownDays,
  now = new Date(),
}: {
  completedAt: Date
  cooldownDays: number
  now?: Date
}) {
  if (!Number.isInteger(cooldownDays) || cooldownDays < 0) {
    throw adaptivePracticeQuizError(
      'The adaptive publication has an invalid retake cooldown.',
      'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
    )
  }
  return (
    completedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000 <= now.getTime()
  )
}
