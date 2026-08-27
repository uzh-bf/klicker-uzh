import type { AnalyticsWorkflowName } from './constants.js'
import { COURSE_WORKFLOW_NAME, PLATFORM_WORKFLOW_NAME } from './constants.js'
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

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property)
}

function requireIdentityEcho<
  Input extends object,
  Output extends object,
  Field extends Extract<keyof Input, keyof Output>,
>(
  input: Input,
  output: Output,
  fields: readonly Field[],
  workflow: string
): void {
  for (const field of fields) {
    if (hasOwn(input, String(field)) !== hasOwn(output, String(field))) {
      throw new Error(
        `${workflow} workflow result changed ${String(field)} presence`
      )
    }
    if (!Object.is(input[field], output[field])) {
      throw new Error(`${workflow} workflow result changed ${String(field)}`)
    }
  }
}

export interface AnalyticsEngineWorkflowStubs {
  course(input: CourseWorkflowInput): Promise<CourseWorkflowSuccess>
  platform(input: PlatformWorkflowInput): Promise<PlatformWorkflowSuccess>
}

export function createAnalyticsEngineStubs(
  invoker: AnalyticsWorkflowInvoker
): AnalyticsEngineWorkflowStubs {
  return {
    async course(input) {
      const parsedInput = courseWorkflowInputSchema.parse(input)
      const identity = { ...parsedInput }
      const output = courseWorkflowSuccessSchema.parse(
        await invoker(COURSE_WORKFLOW_NAME, parsedInput)
      )
      requireIdentityEcho(
        identity,
        output,
        ['contractVersion', 'runId', 'courseId', 'mode', 'windowSince'],
        'Course'
      )
      return output
    },
    async platform(input) {
      const parsedInput = platformWorkflowInputSchema.parse(input)
      const identity = { ...parsedInput }
      const output = platformWorkflowSuccessSchema.parse(
        await invoker(PLATFORM_WORKFLOW_NAME, parsedInput)
      )
      requireIdentityEcho(
        identity,
        output,
        ['contractVersion', 'runId'],
        'Platform'
      )
      return output
    },
  }
}
