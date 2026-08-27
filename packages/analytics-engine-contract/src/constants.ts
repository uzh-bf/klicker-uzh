export const ANALYTICS_ENGINE_CONTRACT_VERSION = 'v1' as const

export const COURSE_WORKFLOW_NAME = 'learning-analytics-course-v1' as const

export const PLATFORM_WORKFLOW_NAME = 'learning-analytics-platform-v1' as const

export const COURSE_WORKFLOW_MODES = [
  'incremental',
  'finalize',
  'full',
] as const

export type CourseWorkflowMode = (typeof COURSE_WORKFLOW_MODES)[number]

export type AnalyticsWorkflowName =
  | typeof COURSE_WORKFLOW_NAME
  | typeof PLATFORM_WORKFLOW_NAME
