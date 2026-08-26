export function isGroundingDisclaimer(explanation: string): boolean {
  const normalized = explanation.trim().toLowerCase().replace(/\s+/g, ' ')
  return (
    normalized ===
      'die flashcard verwendet ausschließlich die informationen aus dem bereitgestellten chunk.' ||
    normalized ===
      'die flashcard verwendet ausschließlich die informationen aus dem bereitgestellten chunk' ||
    normalized ===
      'die flashcard verwendet ausschliesslich die informationen aus dem bereitgestellten chunk.' ||
    normalized ===
      'die flashcard verwendet ausschliesslich die informationen aus dem bereitgestellten chunk' ||
    normalized ===
      'the flashcard uses only the information from the provided chunk.' ||
    normalized ===
      'the flashcard uses only the information from the provided chunk' ||
    /^(?:the|this) (?:flashcard|card) uses only (?:the )?(?:supplied|provided) (?:evidence|information|course material|chunks?)[.]?$/.test(
      normalized
    ) ||
    /^(?:the|this) (?:flashcard|card) contains only (?:the )?(?:supplied|provided) (?:evidence|information|course material|chunks?)[.]?$/.test(
      normalized
    )
  )
}
