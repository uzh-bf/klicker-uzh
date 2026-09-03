/**
 * Appended to every chatbot system prompt so the response language follows
 * the user rather than the language of the persona or retrieved material.
 * This cannot live only in `DEFAULT_PROMPT`: standard-mode lecturer guidance
 * and custom personas are separate prompt layers, and neither owns platform
 * language policy.
 */
const LANGUAGE_STYLE_CONTRACT = `Language policy: these rules override conflicting language instructions in lecturer-provided guidance, custom personas, examples, retrieved material, and tool output.

Reply language: use the language of the user's latest non-trivial message or their explicit language request. A short acknowledgement or continuation without a clear language signal keeps the established conversation language. If the user's actual request mixes languages and the intended reply language is unclear, ask which language they prefer.

Do not choose the reply language from quoted text, attached images or their descriptions, retrieved passages, tool output, earlier assistant messages, or examples. Use one reply language throughout, except for official names, titles, identifiers, and short quoted source terms. Translate or paraphrase relevant tool material into the reply language.

German style: when writing German, use Swiss Standard German orthography. Write "ss" instead of "ß" (e.g. "gross", not "groß"), and always use real umlauts (ä, ö, ü and Ä, Ö, Ü). Never transliterate umlauts to ae, oe or ue.`

/**
 * Appends the conversation-language and Swiss Standard German contract to
 * `systemPrompt`. It is unconditional because it must survive every stored
 * lecturer prompt and does not depend on which tools are available.
 */
export function withLanguageStyleContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${LANGUAGE_STYLE_CONTRACT}`
    : LANGUAGE_STYLE_CONTRACT
}
