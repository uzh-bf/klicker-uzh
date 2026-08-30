import type { HatchetWorkflows, WorkerMode } from '@klicker-uzh/hatchet'

export type ResponseProcessorMode = 'regular' | 'assessment'

export function resolveResponseProcessorMode(
  env: { ASSESSMENT_MODE?: string } = process.env
): ResponseProcessorMode {
  return env.ASSESSMENT_MODE === 'true' ? 'assessment' : 'regular'
}

export function resolveResponseProcessorWorkerMode(
  mode: ResponseProcessorMode
): Extract<WorkerMode, 'regular-response' | 'assessment'> {
  return mode === 'assessment' ? 'assessment' : 'regular-response'
}

export function selectResponseProcessorWorkflows({
  mode,
  regular,
  assessment,
}: {
  mode: ResponseProcessorMode
  regular: HatchetWorkflows
  assessment: HatchetWorkflows
}) {
  return mode === 'assessment' ? assessment : regular
}
