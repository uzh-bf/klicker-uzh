const SOCIAL_MESSAGES = new Set([
  'hi',
  'hello',
  'hey',
  'hallo',
  'guten morgen',
  'guten tag',
  'guten abend',
  'good morning',
  'good afternoon',
  'good evening',
  'thanks',
  'thanks a lot',
  'thank you',
  'thx',
  'danke',
  'danke schön',
  'dankeschön',
  'vielen dank',
  'ok',
  'okay',
  'all good',
  'alles klar',
  'got it',
  'verstanden',
  'sounds good',
  'super',
  'great',
  'perfekt',
  'yes',
  'ja',
  'no',
  'nein',
  'bye',
  'goodbye',
  'tschüss',
  'auf wiedersehen',
  'ciao',
  '👋',
  '👍',
  '🙂',
])

function normalizeMessage(content: string): string {
  return content
    .trim()
    .toLocaleLowerCase('de-CH')
    .replace(/\s+/gu, ' ')
    .replace(/[.!?,;:]+$/gu, '')
    .trim()
}

/**
 * Returns true for the deliberately small set of messages that can proceed
 * without course retrieval. Ambiguous or substantive messages must retrieve.
 */
export function isSocialMessage(content: string): boolean {
  return SOCIAL_MESSAGES.has(normalizeMessage(content))
}

/**
 * Course retrieval is the default for every non-social message when a
 * retrieval tool is available. This keeps answers grounded even when the
 * model already knows a plausible general-knowledge answer.
 */
export function shouldRequireCourseRetrieval(
  content: string,
  hasImage = false
): boolean {
  return (
    hasImage ||
    (normalizeMessage(content).length > 0 && !isSocialMessage(content))
  )
}
