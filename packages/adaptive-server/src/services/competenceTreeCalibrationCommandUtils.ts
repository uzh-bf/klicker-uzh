import { createHash } from 'node:crypto'
import { calibrationServiceError } from './competenceTreeCalibrationRepository.js'

export function assertScaleIdentity(
  scale: { treeId: string },
  expectedTreeId: string
) {
  if (scale.treeId !== expectedTreeId) {
    throw calibrationServiceError(
      'The scale does not belong to the selected tree.',
      'ADAPTIVE_SCALE_IDENTITY_MISMATCH'
    )
  }
}

export function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function parseArtifact<T>(
  input: unknown,
  parse: (input: unknown) => T,
  code: string
): T {
  try {
    return parse(input)
  } catch {
    throw calibrationServiceError(
      'The adaptive measurement artifact is invalid.',
      code
    )
  }
}
