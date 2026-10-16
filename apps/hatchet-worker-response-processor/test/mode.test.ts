import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { HatchetWorkflows } from '@klicker-uzh/hatchet'
import {
  resolveResponseProcessorMode,
  resolveResponseProcessorWorkerMode,
  selectResponseProcessorWorkflows,
} from '../src/mode.js'

test('assessment mode is opt-in and keeps regular mode as the default', () => {
  assert.equal(resolveResponseProcessorMode({}), 'regular')
  assert.equal(
    resolveResponseProcessorMode({ ASSESSMENT_MODE: 'false' }),
    'regular'
  )
  assert.equal(
    resolveResponseProcessorMode({ ASSESSMENT_MODE: 'true' }),
    'assessment'
  )
})

test('regular and assessment modes map to distinct shared worker modes', () => {
  assert.equal(
    resolveResponseProcessorWorkerMode('regular'),
    'regular-response'
  )
  assert.equal(resolveResponseProcessorWorkerMode('assessment'), 'assessment')
})

test('mode selection preserves the regular and assessment workflow collections', () => {
  const regular = [{}] as unknown as HatchetWorkflows
  const assessment = [{}, {}] as unknown as HatchetWorkflows

  assert.equal(
    selectResponseProcessorWorkflows({
      mode: 'regular',
      regular,
      assessment,
    }),
    regular
  )
  assert.equal(
    selectResponseProcessorWorkflows({
      mode: 'assessment',
      regular,
      assessment,
    }),
    assessment
  )
})
