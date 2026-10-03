import { jsonSchema, type ToolSet, tool } from 'ai'
import { REPLY_LANGUAGE_REMINDER } from '@/src/lib/server/languageInstructions'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

export const CALCULATOR_TOOL_NAME = 'calculate'

const MAX_EXPRESSION_LENGTH = 500
const MAX_EXPRESSIONS = 20
const TOKEN_PATTERN = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|[-+*/^()])/iy

/**
 * Evaluates an arithmetic expression with numbers, + - * / ^ and
 * parentheses. A hand-written parser keeps model input away from `eval`.
 * Thousands separators are rejected, so "1,000" cannot be read as 1.
 */
export function evaluateExpression(expression: string): number {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error('Expression is too long')
  }
  const tokens: string[] = []
  TOKEN_PATTERN.lastIndex = 0
  while (TOKEN_PATTERN.lastIndex < expression.length) {
    const start = TOKEN_PATTERN.lastIndex
    const match = TOKEN_PATTERN.exec(expression)
    if (!match) {
      if (/^\s*$/.test(expression.slice(start))) break
      throw new Error(
        `Unsupported input at "${expression.slice(start, start + 10)}". Use plain numbers without thousands separators and the operators + - * / ^ ( ).`
      )
    }
    tokens.push(match[1]!)
  }

  let position = 0
  const peek = () => tokens[position]
  const take = () => tokens[position++]

  // Grammar: sum = product (("+"|"-") product)*
  //          product = unary (("*"|"/") unary)*
  //          unary = "-" unary | "+" unary | power
  //          power = atom ("^" unary)?   (right-associative)
  function sum(): number {
    let value = product()
    while (peek() === '+' || peek() === '-') {
      value = take() === '+' ? value + product() : value - product()
    }
    return value
  }
  function product(): number {
    let value = unary()
    while (peek() === '*' || peek() === '/') {
      value = take() === '*' ? value * unary() : value / unary()
    }
    return value
  }
  function unary(): number {
    if (peek() === '-') {
      take()
      return -unary()
    }
    if (peek() === '+') {
      take()
      return unary()
    }
    return power()
  }
  function power(): number {
    const base = atom()
    if (peek() === '^') {
      take()
      return base ** unary()
    }
    return base
  }
  function atom(): number {
    const token = take()
    if (token === '(') {
      const value = sum()
      if (take() !== ')') throw new Error('Missing closing parenthesis')
      return value
    }
    if (token === undefined || !/^\d/.test(token)) {
      throw new Error('Expected a number')
    }
    return Number(token)
  }

  const result = sum()
  if (position !== tokens.length) throw new Error('Unexpected trailing input')
  if (!Number.isFinite(result)) throw new Error('Result is not finite')
  return result
}

function calculate(expression: string) {
  try {
    const result = Number(evaluateExpression(expression).toPrecision(15))
    return { expression, result }
  } catch (error) {
    return { expression, error: (error as Error).message }
  }
}

// One call takes every expression a reply needs, because each tool call
// costs a model step and replies are limited to a few steps.
const calculatorTool = tool({
  description:
    'Evaluate arithmetic expressions exactly, for example (1+0.043)^7*8200 or 90/1.055+90/1.055^2. Pass every number you will state in one call, including values you confirm, correct, compare, or quote from earlier messages or course material. Write plain numbers without thousands separators.',
  inputSchema: jsonSchema<{ expressions: string[] }>({
    type: 'object',
    properties: {
      expressions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: MAX_EXPRESSIONS,
      },
    },
    required: ['expressions'],
    additionalProperties: false,
  }),
  // The JSON schema is not validated at runtime, so an over-long list is
  // rejected here instead of being cut short with unverified values.
  execute: async ({ expressions }) =>
    expressions.length > MAX_EXPRESSIONS
      ? {
          error: `Pass at most ${MAX_EXPRESSIONS} expressions per call, and put the rest in another call.`,
        }
      : { results: expressions.map(calculate) },
})

/**
 * Adds the calculator to the course tools in modes that check learner
 * calculations. Model arithmetic on powers and discount factors drifts in the
 * second decimal, which is enough to reject a correct learner answer.
 */
function usesCalculator(chatMode: string): boolean {
  return chatMode === 'tutor' || chatMode === 'quizzer'
}

export function withCalculatorTool(chatMode: string, tools: ToolSet): ToolSet {
  if (!usesCalculator(chatMode)) return tools
  return { ...tools, [CALCULATOR_TOOL_NAME]: calculatorTool }
}

const NUMERIC_PRECISION = renderPromptTemplate('numeric-precision', {})

/**
 * Builds the system message that ends every model step. A precision rule
 * only in the system prompt loses to recent conversation, so calculator modes
 * restate it here. It shares one message with the reply-language reminder,
 * which stays last, because separate trailing system messages weakened that
 * reminder in evaluation runs.
 */
export function stepReminder(chatMode: string): {
  role: 'system'
  content: string
} {
  if (!usesCalculator(chatMode)) return REPLY_LANGUAGE_REMINDER
  return {
    role: 'system',
    content: `${NUMERIC_PRECISION}\n\n${REPLY_LANGUAGE_REMINDER.content}`,
  }
}
