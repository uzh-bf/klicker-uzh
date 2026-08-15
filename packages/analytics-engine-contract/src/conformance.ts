import { COURSE_WORKFLOW_NAME, PLATFORM_WORKFLOW_NAME } from './constants.js'
import {
  courseInputWithWindowFixture,
  courseInputWithoutWindowFixture,
  platformInputFixture,
} from './fixtures.js'
import type {
  CourseWorkflowInput,
  CourseWorkflowSuccess,
  PlatformWorkflowInput,
  PlatformWorkflowSuccess,
} from './schemas.js'
import {
  courseWorkflowSuccessSchema,
  platformWorkflowSuccessSchema,
} from './schemas.js'
import type { AnalyticsWorkflowName } from './constants.js'

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

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property)
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Contract conformance failed: ${message}`)
}

function assertCourseEcho(
  input: CourseWorkflowInput,
  output: CourseWorkflowSuccess
): void {
  for (const field of [
    'contractVersion',
    'runId',
    'courseId',
    'mode',
    'windowSince',
  ] as const) {
    assert(
      hasOwn(input, field) === hasOwn(output, field),
      `course ${field} presence changed`
    )
    assert(input[field] === output[field], `course ${field} changed`)
  }
}

function assertPlatformEcho(
  input: PlatformWorkflowInput,
  output: PlatformWorkflowSuccess
): void {
  for (const field of ['contractVersion', 'runId'] as const) {
    assert(input[field] === output[field], `platform ${field} changed`)
  }
}

async function rejectedValue(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation
  } catch (error) {
    return error
  }

  throw new Error('Contract conformance expected a rejected workflow')
}

export async function runBlackBoxConformance(
  callback: ConformanceCallback
): Promise<void> {
  const courseWithWindowOutput = courseWorkflowSuccessSchema.parse(
    await callback(
      'success',
      COURSE_WORKFLOW_NAME,
      courseInputWithWindowFixture
    )
  )
  assertCourseEcho(courseInputWithWindowFixture, courseWithWindowOutput)

  const courseWithoutWindowOutput = courseWorkflowSuccessSchema.parse(
    await callback(
      'success',
      COURSE_WORKFLOW_NAME,
      courseInputWithoutWindowFixture
    )
  )
  assertCourseEcho(courseInputWithoutWindowFixture, courseWithoutWindowOutput)
  assert(
    !hasOwn(courseWithoutWindowOutput, 'windowSince'),
    'course windowSince was added to a windowless result'
  )

  const platformOutput = platformWorkflowSuccessSchema.parse(
    await callback('success', PLATFORM_WORKFLOW_NAME, platformInputFixture)
  )
  assertPlatformEcho(platformInputFixture, platformOutput)

  const invalidInput = {
    ...courseInputWithWindowFixture,
    unexpected: true,
  }
  await rejectedValue(
    callback('invalid-input', COURSE_WORKFLOW_NAME, invalidInput)
  )
  await rejectedValue(
    callback('failure', COURSE_WORKFLOW_NAME, courseInputWithWindowFixture)
  )
  await rejectedValue(
    callback('cancelled', PLATFORM_WORKFLOW_NAME, platformInputFixture)
  )
}
