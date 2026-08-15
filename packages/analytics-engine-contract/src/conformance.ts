import { COURSE_WORKFLOW_NAME, PLATFORM_WORKFLOW_NAME } from './constants.js'
import {
  courseInputWithWindowFixture,
  courseInputWithoutWindowFixture,
  platformInputFixture,
} from './fixtures.js'
import type { AnalyticsWorkflowName } from './constants.js'
import { createAnalyticsEngineStubs } from './stubs.js'

export type ConformanceScenario =
  | 'success'
  | 'invalid-input'
  | 'failure'
  | 'cancelled'

export type ConformanceCallback = (
  scenario: ConformanceScenario,
  workflowName: AnalyticsWorkflowName,
  input: unknown
) => Promise<unknown>

async function requireRejection(operation: Promise<unknown>): Promise<void> {
  try {
    await operation
  } catch (error) {
    return
  }

  throw new Error('Contract conformance expected a rejected workflow')
}

export async function runBlackBoxConformance(
  callback: ConformanceCallback
): Promise<void> {
  const stubs = createAnalyticsEngineStubs((workflowName, input) =>
    callback('success', workflowName, input)
  )
  await stubs.course(courseInputWithWindowFixture)
  await stubs.course(courseInputWithoutWindowFixture)
  await stubs.platform(platformInputFixture)

  const invalidInput = {
    ...courseInputWithWindowFixture,
    unexpected: true,
  }
  await requireRejection(
    callback('invalid-input', COURSE_WORKFLOW_NAME, invalidInput)
  )
  await requireRejection(
    callback('failure', COURSE_WORKFLOW_NAME, courseInputWithWindowFixture)
  )
  await requireRejection(
    callback('cancelled', PLATFORM_WORKFLOW_NAME, platformInputFixture)
  )
}
