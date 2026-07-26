/**
 * Appended to every chatbot system prompt so answers use Swiss High German
 * orthography. This cannot live only in `DEFAULT_PROMPT`: a chatbot's stored
 * prompt replaces the default entirely, so a rule written there silently
 * disappears the moment a lecturer saves a custom prompt. Applying it
 * server-side in the chat route (same pattern as `withCitationContract`)
 * makes the orthography independent of what any individual prompt says.
 *
 * Phrased conditionally ("when writing German") so prompts that answer in
 * another language are unaffected — the rule is about spelling, not about
 * which language to answer in.
 */
const LANGUAGE_STYLE_CONTRACT =
  'Language style: when writing German, use Swiss High German orthography. ' +
  'Write "ss" instead of "ß" (e.g. "gross", not "groß"), and always use real ' +
  'umlauts (ä, ö, ü and Ä, Ö, Ü). Never transliterate umlauts to ae, oe or ue.'

/**
 * Appends the Swiss High German orthography contract to `systemPrompt`.
 * Unconditional — unlike the citation contract, this does not depend on
 * which tools are available.
 */
export function withLanguageStyleContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${LANGUAGE_STYLE_CONTRACT}`
    : LANGUAGE_STYLE_CONTRACT
}
