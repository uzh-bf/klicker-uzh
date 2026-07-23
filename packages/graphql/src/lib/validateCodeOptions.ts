import type {
  CodeTestCase,
  ElementOptionsInput,
  JsonValue,
  OptionsCodeInput,
} from '@klicker-uzh/types'

const PYTHON_ENTRYPOINT = /^[A-Za-z_][A-Za-z0-9_]*$/
const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
])
const UNSAFE_RESULT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return false
    }
    return Object.values(value).every(isJsonValue)
  }

  return false
}

type ValidatedCodeOptionsInput = Omit<
  OptionsCodeInput,
  'language' | 'entrypoint' | 'testCases'
> & {
  language: 'python'
  entrypoint: string
  testCases: CodeTestCase[]
}

function validateCodeOptions(
  options?: ElementOptionsInput | null
): options is ElementOptionsInput & ValidatedCodeOptionsInput {
  if (
    !options ||
    options.language !== 'python' ||
    (options.starterCode != null && typeof options.starterCode !== 'string') ||
    (options.sampleSolution != null &&
      typeof options.sampleSolution !== 'string') ||
    typeof options.hasSampleSolution !== 'boolean' ||
    (options.hasSampleSolution &&
      (typeof options.sampleSolution !== 'string' ||
        options.sampleSolution.trim().length === 0)) ||
    typeof options.entrypoint !== 'string' ||
    !PYTHON_ENTRYPOINT.test(options.entrypoint) ||
    PYTHON_KEYWORDS.has(options.entrypoint) ||
    !Array.isArray(options.testCases) ||
    options.testCases.length < 1 ||
    options.testCases.length > 20
  ) {
    return false
  }

  const testIds = new Set<string>()
  return options.testCases.every((testCase) => {
    if (
      typeof testCase.id !== 'string' ||
      testCase.id.trim().length === 0 ||
      UNSAFE_RESULT_KEYS.has(testCase.id) ||
      testIds.has(testCase.id) ||
      typeof testCase.name !== 'string' ||
      testCase.name.trim().length === 0 ||
      !Array.isArray(testCase.args) ||
      !testCase.args.every(isJsonValue) ||
      !isJsonValue(testCase.expectedOutput) ||
      (testCase.visibility !== 'public' && testCase.visibility !== 'hidden') ||
      typeof testCase.weight !== 'number' ||
      !Number.isFinite(testCase.weight) ||
      testCase.weight <= 0
    ) {
      return false
    }

    testIds.add(testCase.id)
    return true
  })
}

export default validateCodeOptions
