import type { AnalyticsWorkflowName } from './constants.js'
import {
  COURSE_WORKFLOW_NAME as COURSE_WORKFLOW,
  PLATFORM_WORKFLOW_NAME as PLATFORM_WORKFLOW,
} from './constants.js'
import {
  courseWorkflowInputSchema,
  courseWorkflowSuccessSchema,
  platformWorkflowInputSchema,
  platformWorkflowSuccessSchema,
} from './schemas.js'
import type {
  CourseWorkflowInput,
  CourseWorkflowSuccess,
  PlatformWorkflowInput,
  PlatformWorkflowSuccess,
} from './schemas.js'

export type AnalyticsWorkflowInvoker = (
  workflowName: AnalyticsWorkflowName,
  input: unknown
) => Promise<unknown>

export type CourseWorkflowStub = (
  input: CourseWorkflowInput
) => Promise<CourseWorkflowSuccess>

export type PlatformWorkflowStub = (
  input: PlatformWorkflowInput
) => Promise<PlatformWorkflowSuccess>

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property)
}

function requireCourseIdentityEcho(
  input: CourseWorkflowInput,
  output: CourseWorkflowSuccess
): void {
  const identityFields = [
    'contractVersion',
    'runId',
    'courseId',
    'mode',
    'windowSince',
  ] as const

  for (const field of identityFields) {
    if (hasOwn(input, field) !== hasOwn(output, field)) {
      throw new Error(`Course workflow result changed ${field} presence`)
    }

    if (input[field] !== output[field]) {
      throw new Error(`Course workflow result changed ${field}`)
    }
  }
}

function requirePlatformIdentityEcho(
  input: PlatformWorkflowInput,
  output: PlatformWorkflowSuccess
): void {
  for (const field of ['contractVersion', 'runId'] as const) {
    if (input[field] !== output[field]) {
      throw new Error(`Platform workflow result changed ${field}`)
    }
  }
}

export function createCourseWorkflowStub(
  invoker: AnalyticsWorkflowInvoker
): CourseWorkflowStub {
  return async (input) => {
    const validatedInput = courseWorkflowInputSchema.parse(input)
    const rawOutput = await invoker(COURSE_WORKFLOW, validatedInput)
    const validatedOutput = courseWorkflowSuccessSchema.parse(rawOutput)

    requireCourseIdentityEcho(validatedInput, validatedOutput)
    return validatedOutput
  }
}

export function createPlatformWorkflowStub(
  invoker: AnalyticsWorkflowInvoker
): PlatformWorkflowStub {
  return async (input) => {
    const validatedInput = platformWorkflowInputSchema.parse(input)
    const rawOutput = await invoker(PLATFORM_WORKFLOW, validatedInput)
    const validatedOutput = platformWorkflowSuccessSchema.parse(rawOutput)

    requirePlatformIdentityEcho(validatedInput, validatedOutput)
    return validatedOutput
  }
}

export interface AnalyticsEngineWorkflowStubs {
  readonly course: CourseWorkflowStub
  readonly platform: PlatformWorkflowStub
}

export function createAnalyticsEngineStubs(
  invoker: AnalyticsWorkflowInvoker
): AnalyticsEngineWorkflowStubs {
  return {
    course: createCourseWorkflowStub(invoker),
    platform: createPlatformWorkflowStub(invoker),
  }
}
