type MathKind =
  | 'dollar'
  | 'double-dollar'
  | 'paren'
  | 'bracket'
  | 'inline-tag'
  | 'display-tag'

type MathOpening = {
  kind: MathKind
  length: number
}

type MathState = {
  kind: MathKind
  start: number
}

const MULTI_CHARACTER_OPENERS = [
  '[/math]',
  '[/inline]',
  '\\\\[',
  '\\[',
  '\\\\(',
  '\\(',
] as const

export type StreamingMathScan = {
  hasMathOpener: boolean
  incompleteMathStart: number | null
}

function isEscaped(input: string, index: number) {
  let backslashes = 0
  for (
    let cursor = index - 1;
    cursor >= 0 && input[cursor] === '\\';
    cursor--
  ) {
    backslashes++
  }

  return backslashes % 2 === 1
}

function isLineStart(input: string, index: number) {
  return index === 0 || input[index - 1] === '\n'
}

function countRun(input: string, index: number, character: string) {
  let length = 0
  while (input[index + length] === character) length++
  return length
}

type Fence = {
  character: '`' | '~'
  length: number
  start: number
}

function readFence(input: string, index: number): Fence | null {
  if (!isLineStart(input, index)) return null

  let cursor = index
  let indentation = 0
  while (indentation < 3 && input[cursor] === ' ') {
    cursor++
    indentation++
  }

  const character = input[cursor]
  if (character !== '`' && character !== '~') return null

  const length = countRun(input, cursor, character)
  if (length < 3) return null

  return { character, length, start: cursor }
}

function isFenceClose(input: string, index: number, fence: Fence) {
  const candidate = readFence(input, index)
  if (
    !candidate ||
    candidate.character !== fence.character ||
    candidate.length < fence.length
  ) {
    return false
  }

  const lineEnd = input.indexOf('\n', index)
  const end = lineEnd === -1 ? input.length : lineEnd
  const markerEnd = candidate.start + candidate.length
  return input.slice(markerEnd, end).trim().length === 0
}

function isDollarOpening(input: string, index: number) {
  if (isEscaped(input, index) || input[index + 1] === '$') return false

  const next = input[index + 1]
  return next === undefined || !/\s|\d/.test(next)
}

function findOpening(input: string, index: number): MathOpening | null {
  if (input.startsWith('[/math]', index)) {
    return { kind: 'display-tag', length: '[/math]'.length }
  }
  if (input.startsWith('[/inline]', index)) {
    return { kind: 'inline-tag', length: '[/inline]'.length }
  }
  if (input.startsWith('\\\\[', index)) {
    return { kind: 'bracket', length: 3 }
  }
  if (input.startsWith('\\[', index)) {
    return { kind: 'bracket', length: 2 }
  }
  if (input.startsWith('\\\\(', index)) {
    return { kind: 'paren', length: 3 }
  }
  if (input.startsWith('\\(', index)) {
    return { kind: 'paren', length: 2 }
  }
  if (!isEscaped(input, index) && input.startsWith('$$', index)) {
    return { kind: 'double-dollar', length: 2 }
  }
  if (input[index] === '$' && isDollarOpening(input, index)) {
    return { kind: 'dollar', length: 1 }
  }

  return null
}

function isOpeningPrefix(input: string, index: number) {
  const suffix = input.slice(index)
  if (suffix.length === 0) return false

  return MULTI_CHARACTER_OPENERS.some(
    (opener) => suffix.length < opener.length && opener.startsWith(suffix)
  )
}

function findClosingLength(input: string, index: number, kind: MathKind) {
  switch (kind) {
    case 'display-tag':
      return input.startsWith('[/math]', index) ? '[/math]'.length : 0
    case 'inline-tag':
      return input.startsWith('[/inline]', index) ? '[/inline]'.length : 0
    case 'bracket':
      if (input.startsWith('\\\\]', index)) return 3
      return input.startsWith('\\]', index) ? 2 : 0
    case 'paren':
      if (input.startsWith('\\\\)', index)) return 3
      return input.startsWith('\\)', index) ? 2 : 0
    case 'double-dollar':
      return !isEscaped(input, index) && input.startsWith('$$', index) ? 2 : 0
    case 'dollar':
      return !isEscaped(input, index) &&
        input[index] === '$' &&
        input[index + 1] !== '$'
        ? 1
        : 0
  }
}

/**
 * Finds math delimiters without asking a Markdown parser to interpret a
 * partial answer. The returned prefix is safe to render during a stream.
 */
export function inspectStreamingMath(input: string): StreamingMathScan {
  let math: MathState | null = null
  let fence: Fence | null = null
  let hasMathOpener = false

  for (let index = 0; index < input.length; index++) {
    if (fence) {
      const candidate = isLineStart(input, index)
        ? readFence(input, index)
        : null
      if (candidate && isFenceClose(input, index, fence)) {
        fence = null
        index = candidate.start + candidate.length - 1
      }
      continue
    }

    if (math) {
      const closingLength = findClosingLength(input, index, math.kind)
      if (closingLength > 0) {
        math = null
        index += closingLength - 1
      }
      continue
    }

    if (isLineStart(input, index)) {
      const nextFence = readFence(input, index)
      if (nextFence) {
        fence = nextFence
        continue
      }
    }

    if (input[index] === '`') {
      const codeLength = countRun(input, index, '`')
      const closing = input.indexOf('`'.repeat(codeLength), index + codeLength)
      if (closing === -1) break
      index = closing + codeLength - 1
      continue
    }

    const opening = findOpening(input, index)
    if (!opening) {
      if (isOpeningPrefix(input, index)) {
        hasMathOpener = true
        math = { kind: 'bracket', start: index }
        break
      }
      continue
    }

    hasMathOpener = true
    math = { kind: opening.kind, start: index }
    index += opening.length - 1
  }

  return {
    hasMathOpener,
    incompleteMathStart: math?.start ?? null,
  }
}

export function hideIncompleteMath(input: string) {
  const { incompleteMathStart } = inspectStreamingMath(input)
  return incompleteMathStart === null
    ? input
    : input.slice(0, incompleteMathStart)
}

/** CommonMark closes a code span with a backtick run of the same length. */
function findCodeSpanEnd(
  input: string,
  index: number,
  runLength: number
): number {
  const run = '`'.repeat(runLength)
  let candidate = input.indexOf(run, index + runLength)
  while (candidate !== -1 && input[candidate + runLength] === '`') {
    candidate = input.indexOf(run, candidate + 1)
  }
  return candidate
}

/**
 * Blanks out fenced code blocks and code spans while keeping the input length
 * and every offset outside those regions, so a text scan can skip exactly what
 * the Markdown parser treats as literal code. An unterminated fence masks the
 * rest of the input, matching how the renderer shows a half-streamed answer.
 */
export function maskCodeRegions(input: string): string {
  if (!input.includes('`') && !input.includes('~')) return input

  const masked = input.split('')
  const blank = (start: number, end: number) => {
    for (let cursor = start; cursor < end && cursor < masked.length; cursor++) {
      if (masked[cursor] !== '\n') masked[cursor] = ' '
    }
  }

  let index = 0
  while (index < input.length) {
    const fence = isLineStart(input, index) ? readFence(input, index) : null
    if (fence) {
      let cursor = fence.start + fence.length
      while (cursor < input.length) {
        const close = isLineStart(input, cursor)
          ? readFence(input, cursor)
          : null
        if (close && isFenceClose(input, cursor, fence)) {
          cursor = close.start + close.length
          break
        }
        cursor += 1
      }
      blank(fence.start, cursor)
      index = cursor
      continue
    }

    if (input[index] === '`') {
      const runLength = countRun(input, index, '`')
      const closing = findCodeSpanEnd(input, index, runLength)
      const end = closing === -1 ? input.length : closing + runLength
      blank(index, end)
      index = end
      continue
    }

    index += 1
  }

  return masked.join('')
}

function isSingleDollar(input: string, index: number) {
  return (
    input[index] === '$' &&
    input[index - 1] !== '$' &&
    input[index + 1] !== '$' &&
    !isEscaped(input, index)
  )
}

// Pandoc's rule: a closing `$` follows a non-space character and is not
// followed by a digit, so "$90,000, leaving $10,000" is not a formula. Only
// the next single `$` can close, as in remark-math, and dollars inside code
// spans are skipped because they never close math.
function findInlineMathClose(input: string, opening: number) {
  for (let index = opening + 1; index < input.length; index++) {
    if (input.startsWith('\n\n', index)) return -1
    if (input[index] === '`') {
      const codeLength = countRun(input, index, '`')
      const closing = input.indexOf('`'.repeat(codeLength), index + codeLength)
      index = (closing === -1 ? index : closing) + codeLength - 1
      continue
    }
    if (isSingleDollar(input, index)) {
      const closes =
        !/\s/.test(input[index - 1] ?? '') && !/\d/.test(input[index + 1] ?? '')
      return closes ? index : -1
    }
  }

  return -1
}

/**
 * Escapes single dollar signs that do not form inline math, such as currency
 * amounts, because remark-math would otherwise pair them across prose. Code
 * spans, fenced code and `$$` display math are left unchanged.
 */
export function escapeNonMathDollars(input: string) {
  let output = ''
  let fence: Fence | null = null

  for (let index = 0; index < input.length; index++) {
    if (isLineStart(input, index)) {
      const candidate = readFence(input, index)
      const opens: boolean = !fence && candidate !== null
      if (opens || (fence && isFenceClose(input, index, fence))) {
        fence = opens ? candidate : null
        const lineEnd = input.indexOf('\n', index)
        const end = lineEnd === -1 ? input.length : lineEnd
        output += input.slice(index, end)
        index = end - 1
        continue
      }
    }
    if (fence) {
      output += input[index]
      continue
    }

    if (input[index] === '`') {
      const codeLength = countRun(input, index, '`')
      const closing = input.indexOf('`'.repeat(codeLength), index + codeLength)
      const end = closing === -1 ? index + codeLength : closing + codeLength
      output += input.slice(index, end)
      index = end - 1
      continue
    }

    if (!isEscaped(input, index) && input.startsWith('$$', index)) {
      const closing = input.indexOf('$$', index + 2)
      const end = closing === -1 ? input.length : closing + 2
      output += input.slice(index, end)
      index = end - 1
      continue
    }

    if (isSingleDollar(input, index)) {
      const opensMath = !/\s/.test(input[index + 1] ?? ' ')
      const closing = opensMath ? findInlineMathClose(input, index) : -1
      if (closing !== -1) {
        output += input.slice(index, closing + 1)
        index = closing
        continue
      }
      output += '\\$'
      continue
    }

    output += input[index]
  }

  return output
}
