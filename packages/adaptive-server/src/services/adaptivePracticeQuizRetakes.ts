import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'

export function adaptiveRetakeAvailableAt({
  completedAt,
  cooldownDays,
}: {
  completedAt: Date
  cooldownDays: number
}) {
  if (!Number.isInteger(cooldownDays) || cooldownDays < 0) {
    throw adaptivePracticeQuizError(
      'The adaptive publication has an invalid retake cooldown.',
      'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
    )
  }
  return new Date(completedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000)
}

export function isAdaptiveRetakeCooldownElapsed({
  completedAt,
  cooldownDays,
  now = new Date(),
}: {
  completedAt: Date
  cooldownDays: number
  now?: Date
}) {
  return (
    adaptiveRetakeAvailableAt({ completedAt, cooldownDays }).getTime() <=
    now.getTime()
  )
}
