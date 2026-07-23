import assert from 'node:assert/strict'
import test from 'node:test'

import { patchPrismaNamespaceSource } from './patchPrismaNamespace.mjs'

const generatedLines = [
  'export const DbNull = runtime.objectEnumValues.instances.DbNull',
  'export const JsonNull = runtime.objectEnumValues.instances.JsonNull',
  'export const AnyNull = runtime.objectEnumValues.instances.AnyNull',
]

const patchedLines = [
  'export const DbNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.DbNull',
  'export const JsonNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.JsonNull',
  'export const AnyNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.AnyNull',
]

test('patches each expected Prisma namespace declaration exactly once', () => {
  assert.equal(
    patchPrismaNamespaceSource(generatedLines.join('\n')),
    patchedLines.join('\n')
  )
})

test('accepts an already-patched namespace without changing it', () => {
  const source = patchedLines.join('\n')
  assert.equal(patchPrismaNamespaceSource(source), source)
})

test('fails when an expected declaration is missing', () => {
  assert.throws(
    () => patchPrismaNamespaceSource(generatedLines.slice(0, 2).join('\n')),
    /generated=0, patched=0/
  )
})

test('fails when an expected declaration is duplicated', () => {
  assert.throws(
    () =>
      patchPrismaNamespaceSource(
        [...generatedLines, generatedLines[0]].join('\n')
      ),
    /generated=2, patched=0/
  )
})
