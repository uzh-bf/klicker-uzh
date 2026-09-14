import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS,
  selectHatchetWorkflows,
} from '../src/workflowSelection.js'

function workflows(...keys: string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, { key }])
  ) as unknown as PreparedHatchetTasks
}

const productionWorkflows = workflows(
  ...REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS,
  'createAuditLogEntry'
)

describe('selectHatchetWorkflows', () => {
  it('defaults to every available workflow only in a local runtime', () => {
    const available = workflows('first', 'second')
    const selected = selectHatchetWorkflows(available, {
      nodeEnv: 'test',
    })

    assert.deepEqual(selected.keys, ['first', 'second'])
    assert.deepEqual(selected.workflows, [
      (available as any).first,
      (available as any).second,
    ])
  })

  it('requires an explicit allowlist outside development and test', () => {
    for (const nodeEnv of [undefined, 'production', 'staging', 'typo']) {
      assert.throws(
        () =>
          selectHatchetWorkflows(productionWorkflows, {
            nodeEnv,
          }),
        /required outside development and test/
      )
    }
  })

  it('selects the exact configured workflows in order', () => {
    const configuredKeys = [
      ...REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS,
      'createAuditLogEntry',
    ].join(',')
    const selected = selectHatchetWorkflows(productionWorkflows, {
      configuredKeys,
      nodeEnv: 'production',
    })

    assert.deepEqual(selected.keys, [
      ...REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS,
      'createAuditLogEntry',
    ])
    assert.equal(
      selected.keys.filter((key) => key === 'repairImportExportFingerprints')
        .length,
      1
    )
  })

  it('rejects explicit empty, blank entries, duplicates, and unknown keys', () => {
    for (const [configuredKeys, expected] of [
      ['', /must not be empty/],
      ['refreshImportExportFingerprints,', /empty workflow key/],
      [
        'refreshImportExportFingerprints,refreshImportExportFingerprints',
        /duplicate workflow keys/,
      ],
      ['unknown', /unknown workflow keys/],
    ] as const) {
      assert.throws(
        () =>
          selectHatchetWorkflows(productionWorkflows, {
            configuredKeys,
            nodeEnv: 'test',
          }),
        expected
      )
    }
  })

  it('rejects a strict-runtime allowlist missing required maintenance workflows', () => {
    for (const nodeEnv of [undefined, 'production', 'staging', 'typo']) {
      assert.throws(
        () =>
          selectHatchetWorkflows(productionWorkflows, {
            configuredKeys:
              REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS.slice(1).join(','),
            nodeEnv,
          }),
        /missing required import\/export workflows: refreshImportExportFingerprints/
      )
    }
  })

  it('rejects a strict-runtime allowlist missing fingerprint repair', () => {
    assert.throws(
      () =>
        selectHatchetWorkflows(productionWorkflows, {
          configuredKeys: REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS.filter(
            (key) => key !== 'repairImportExportFingerprints'
          ).join(','),
          nodeEnv: 'production',
        }),
      /missing required import\/export workflows: repairImportExportFingerprints/
    )
  })

  it('does not require import/export maintenance workflows for an assessment responsibility', () => {
    const available = workflows('createAuditLogEntry')
    const selected = selectHatchetWorkflows(available, {
      configuredKeys: 'createAuditLogEntry',
      nodeEnv: 'production',
      requireImportExportMaintenance: false,
    })

    assert.deepEqual(selected.keys, ['createAuditLogEntry'])
    assert.equal(
      selected.keys.some((key) =>
        REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS.includes(
          key as (typeof REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS)[number]
        )
      ),
      false
    )
  })

  it('excludes import/export maintenance from the unconfigured non-production assessment default', () => {
    const available = workflows(
      ...REQUIRED_IMPORT_EXPORT_WORKFLOW_KEYS,
      'createAuditLogEntry'
    )
    const selected = selectHatchetWorkflows(available, {
      nodeEnv: 'test',
      requireImportExportMaintenance: false,
    })

    assert.deepEqual(selected.keys, ['createAuditLogEntry'])
  })

  it('rejects a configured import/export workflow for an assessment responsibility', () => {
    assert.throws(
      () =>
        selectHatchetWorkflows(productionWorkflows, {
          configuredKeys: [
            'createAuditLogEntry',
            'cleanupImportExportPackages',
          ].join(','),
          nodeEnv: 'production',
          requireImportExportMaintenance: false,
        }),
      /must not include import\/export maintenance workflows/
    )
  })
})
