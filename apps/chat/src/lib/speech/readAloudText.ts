// Turns an assistant message's raw Markdown into text a speech synthesizer can
// read without vocalising syntax. Fenced code is skipped, display math becomes
// a short spoken word, and citation markers are dropped. Inline code and
// inline math keep their content but lose their delimiters. Other Markdown
// (emphasis, headings, links) is left to the voice, which mostly ignores it.

// A fenced block up to its matching closing fence, or to the end of the text
// while the fence is still unclosed. Runs first because code can contain `$`
// and `[1]`, which the later steps would otherwise rewrite.
const FENCED_CODE_RE =
  /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*[\s\S]*?(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g

// The display-math spellings the renderer accepts (see
// `normalizeCustomMathTags` in `markdown-text.tsx`).
const DISPLAY_MATH_RES = [
  /\[\/math\][\s\S]*?\[\/math\]/g,
  /\$\$[\s\S]*?\$\$/g,
  /\\{1,2}\[[\s\S]*?\\{1,2}\]/g,
]

const INLINE_MATH_RES = [
  /\[\/inline\]([\s\S]*?)\[\/inline\]/g,
  /\\{1,2}\(([\s\S]*?)\\{1,2}\)/g,
  // Pandoc's rule, so currency such as "$5 and $10" stays as written.
  /\$(?=\S)([^$\n]*?\S)\$(?!\d)/g,
]

const INLINE_CODE_RE = /`([^`\n]+)`/g

// Same marker shape as `remarkCitationMarkers` (`[1]`, `[2–4]`), including
// the spacing before it, so "Mittel [1]." is read as "Mittel.".
const CITATION_MARKER_RE = /[ \t]*\[\d{1,2}(?:[ \t]*[-–—][ \t]*\d{1,2})?\]/g

export function toSpeakableText(
  markdown: string,
  { formulaLabel }: { formulaLabel: string }
): string {
  let text = markdown.replace(FENCED_CODE_RE, '$1')
  for (const re of DISPLAY_MATH_RES) {
    text = text.replace(re, () => ` ${formulaLabel} `)
  }
  for (const re of INLINE_MATH_RES) {
    text = text.replace(re, (_, content: string) => content.trim())
  }
  return text
    .replace(INLINE_CODE_RE, '$1')
    .replace(CITATION_MARKER_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
