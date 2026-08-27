import type { CourseWorkflowInput, PlatformWorkflowInput } from './schemas.js'

export const courseInputWithWindowFixture = {
  contractVersion: 'v1',
  runId: '00000000-0000-4000-8000-000000000001',
  courseId: '00000000-0000-4000-8000-000000000002',
  mode: 'incremental',
  windowSince: '2026-08-01',
} as const satisfies CourseWorkflowInput

export const courseInputWithoutWindowFixture = {
  contractVersion: 'v1',
  runId: '00000000-0000-4000-8000-000000000003',
  courseId: '00000000-0000-4000-8000-000000000004',
  mode: 'full',
} as const satisfies CourseWorkflowInput

export const platformInputFixture = {
  contractVersion: 'v1',
  runId: '00000000-0000-4000-8000-000000000005',
} as const satisfies PlatformWorkflowInput
