import type {
  CodeTestCase,
  ElementOptionsInput,
  OptionsCodeInput,
} from '@klicker-uzh/types'
import {
  areCodeTestWeightsValid,
  CODE_TEST_ID_MAX_LENGTH,
  CODE_TEST_MAX_COUNT,
  isCodeJsonValue,
  isValidPythonEntrypoint,
} from '@klicker-uzh/types'
const UNSAFE_RESULT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

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
    !isValidPythonEntrypoint(options.entrypoint) ||
    !Array.isArray(options.testCases) ||
    options.testCases.length < 1 ||
    options.testCases.length > CODE_TEST_MAX_COUNT
  ) {
    return false
  }

  const testIds = new Set<string>()
  const testsValid = options.testCases.every((testCase) => {
    if (
      typeof testCase.id !== 'string' ||
      testCase.id.trim().length === 0 ||
      testCase.id.length > CODE_TEST_ID_MAX_LENGTH ||
      UNSAFE_RESULT_KEYS.has(testCase.id) ||
      testIds.has(testCase.id) ||
      typeof testCase.name !== 'string' ||
      testCase.name.trim().length === 0 ||
      !Array.isArray(testCase.args) ||
      !isCodeJsonValue(testCase.args) ||
      !isCodeJsonValue(testCase.expectedOutput) ||
      (testCase.visibility !== 'public' && testCase.visibility !== 'hidden')
    ) {
      return false
    }

    testIds.add(testCase.id)
    return true
  })
  return (
    testsValid &&
    areCodeTestWeightsValid(options.testCases.map(({ weight }) => weight))
  )
}

export default validateCodeOptions
