import { createHash } from 'node:crypto'

import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  COURSE_WORKFLOW_MODES,
  COURSE_WORKFLOW_NAME,
  PLATFORM_WORKFLOW_NAME,
} from './constants.js'

const versionField = [
  'contractVersion',
  'required',
  'literal',
  ANALYTICS_ENGINE_CONTRACT_VERSION,
] as const
const runIdField = ['runId', 'required', 'uuid'] as const
const courseFields = [
  versionField,
  runIdField,
  ['courseId', 'required', 'uuid'],
  ['mode', 'required', 'enum', COURSE_WORKFLOW_MODES],
  ['windowSince', 'optional', 'calendar-date', 'YYYY-MM-DD'],
] as const
const completedAtField = [
  'completedAt',
  'required',
  'datetime',
  'RFC3339-with-offset',
] as const

export const canonicalContract = [
  ['generation', ANALYTICS_ENGINE_CONTRACT_VERSION],
  [
    'workflow',
    COURSE_WORKFLOW_NAME,
    'strict',
    [
      ['input', courseFields],
      ['success', [...courseFields, completedAtField]],
    ],
  ],
  [
    'workflow',
    PLATFORM_WORKFLOW_NAME,
    'strict',
    [
      ['input', [versionField, runIdField]],
      ['success', [versionField, runIdField, completedAtField]],
    ],
  ],
] as const

export const canonicalContractDigest = createHash('sha256')
  .update(JSON.stringify(canonicalContract))
  .digest('hex')
