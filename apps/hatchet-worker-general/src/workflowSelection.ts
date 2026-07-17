import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'

export const REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS = [
  'refreshImportExportFingerprints',
  'repairImportExportFingerprints',
  'cleanupImportExportPackages',
] as const satisfies readonly (keyof PreparedHatchetTasks)[]
const REQUIRED_IMPORT_EXPORT_WORKFLOW_KEY_SET = new Set<
  keyof PreparedHatchetTasks
>(REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS)

export type SelectedHatchetWorkflows = {
  keys: Array<keyof PreparedHatchetTasks>
  workflows: Array<PreparedHatchetTasks[keyof PreparedHatchetTasks]>
}

function isLocalRuntime(nodeEnv: string | undefined) {
  return nodeEnv === 'development' || nodeEnv === 'test'
}

export function selectHatchetWorkflows(
  workflows: PreparedHatchetTasks,
  {
    configuredKeys = process.env.HATCHET_WORKFLOWS,
    nodeEnv = process.env.NODE_ENV,
    requireImportExportMaintenance = true,
  }: {
    configuredKeys?: string
    nodeEnv?: string
    requireImportExportMaintenance?: boolean
  } = {}
): SelectedHatchetWorkflows {
  const availableKeys = Object.keys(workflows) as Array<
    keyof PreparedHatchetTasks
  >
  const strictRuntime = !isLocalRuntime(nodeEnv)

  if (typeof configuredKeys === 'undefined') {
    if (strictRuntime) {
      throw new Error(
        'HATCHET_WORKFLOWS is required outside development and test.'
      )
    }

    const defaultKeys = requireImportExportMaintenance
      ? availableKeys
      : availableKeys.filter(
          (key) => !REQUIRED_IMPORT_EXPORT_WORKFLOW_KEY_SET.has(key)
        )

    return {
      keys: defaultKeys,
      workflows: defaultKeys.map((key) => workflows[key]),
    }
  }

  if (configuredKeys.trim().length === 0) {
    throw new Error('HATCHET_WORKFLOWS must not be empty.')
  }

  const rawKeys = configuredKeys.split(',').map((key) => key.trim())
  if (rawKeys.some((key) => key.length === 0)) {
    throw new Error('HATCHET_WORKFLOWS contains an empty workflow key.')
  }

  const duplicateKeys = rawKeys.filter(
    (key, index) => rawKeys.indexOf(key) !== index
  )
  if (duplicateKeys.length > 0) {
    throw new Error(
      `HATCHET_WORKFLOWS contains duplicate workflow keys: ${Array.from(
        new Set(duplicateKeys)
      ).join(', ')}`
    )
  }

  const unknownKeys = rawKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(workflows, key)
  )
  if (unknownKeys.length > 0) {
    throw new Error(
      `HATCHET_WORKFLOWS contains unknown workflow keys: ${unknownKeys.join(
        ', '
      )}`
    )
  }

  const keys = rawKeys as Array<keyof PreparedHatchetTasks>
  if (
    !requireImportExportMaintenance &&
    keys.some((key) => REQUIRED_IMPORT_EXPORT_WORKFLOW_KEY_SET.has(key))
  ) {
    throw new Error(
      'HATCHET_WORKFLOWS must not include import/export maintenance workflows for this process.'
    )
  }
  if (strictRuntime && requireImportExportMaintenance) {
    const missingRequired = REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS.filter(
      (key) => !keys.includes(key)
    )
    if (missingRequired.length > 0) {
      throw new Error(
        `HATCHET_WORKFLOWS is missing required import/export workflows: ${missingRequired.join(
          ', '
        )}`
      )
    }
  }

  return {
    keys,
    workflows: keys.map((key) => workflows[key]),
  }
}
