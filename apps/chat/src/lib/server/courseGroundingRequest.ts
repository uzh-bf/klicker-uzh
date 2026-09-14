/** A bounded explicit-request rule, not a classifier for vague course questions. */
export function requestsCourseGrounding(text: string): boolean {
  return text.split(/[.!?\n]+/).some((sentence) => {
    const normalized = sentence.toLowerCase().replace(/[’‘]/g, "'")
    // Respect an explicit opt-out, including "without using course material".
    if (
      /\b(?:don't|do not|don't ever|never|without|nicht|keine?n?|ohne)\b/.test(
        normalized
      )
    )
      return false

    const material =
      /\b(?:course materia(?:ls?)?|course notes|lecture notes|kursmaterial(?:ien)?|kursunterlagen|vorlesungsunterlagen)\b/
    const request =
      /\b(?:ground|base|use|using|consult|search|check|refer to|according to|based on|anhand|nutze|nutzen|verwende|verwenden|suche|such|beziehe)\b/
    return material.test(normalized) && request.test(normalized)
  })
}

const standaloneAcknowledgments = new Set([
  'hi',
  'hello',
  'hey',
  'good morning',
  'good afternoon',
  'good evening',
  'thanks',
  'thank you',
  'thanks a lot',
  'ok',
  'okay',
  'got it',
  'understood',
  'hallo',
  'guten morgen',
  'guten tag',
  'guten abend',
  'danke',
  'danke schön',
  'dankeschön',
  'vielen dank',
  'alles klar',
  'verstanden',
])

/** Default to search for uncertain messages, including short follow-ups. */
export function shouldSearchCourseMaterial(text: string): boolean {
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .trim()
  // Preserve a student's explicit instruction not to consult course material.
  if (
    /\b(?:don't|do not|never)\s+(?:use|search|consult|check)\s+(?:the\s+)?(?:course materials?|course notes|lecture notes)\b/.test(
      normalized
    ) ||
    /\b(?:nutze|verwende|suche)\s+(?:nicht\s+in\s+den|keine[nr]?)\s+(?:kursmaterialien|kursunterlagen|vorlesungsunterlagen)\b/.test(
      normalized
    )
  )
    return false

  const utterance = normalized
    .replace(/[.!?,…]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  return !standaloneAcknowledgments.has(utterance)
}
