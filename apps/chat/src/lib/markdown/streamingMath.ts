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
    if (!opening) continue

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
