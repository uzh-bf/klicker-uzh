#!/usr/bin/env tsx

// Operator-only registration for KB imported-source metadata.
//
// Offline validation is the default and never loads the database client or
// reads credentials: the manifest is parsed and summarized on its own.
// Documented offline invocation (no secret injection):
//   pnpm exec tsx src/scripts/registerImportedKbSources.ts --manifest <path>
//
// A database apply additionally requires the fingerprint printed by that run
// and a configured database, so a reviewed manifest cannot change unnoticed.
// Apply runs through the Infisical-injected wrapper:
//   pnpm script src/scripts/registerImportedKbSources.ts \
//     --manifest <path> --apply --fingerprint <sha256>

import { readFileSync, statSync } from 'node:fs'
import {
  registerImportedKbSources,
  validateImportedKbSourcesManifest,
} from '../services/knowledgeImportedSources.js'

const MAX_MANIFEST_BYTES = 4 * 1024 * 1024

type RegistrationSummary = {
  status: 'validated' | 'applied' | 'noop' | 'failed'
  fingerprint?: string
  sourceCount?: number
  insertedCount?: number
  existingCount?: number
  errorCode?: string
}

function readOption(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function report(summary: RegistrationSummary) {
  // Only counts, the fingerprint and an error code are emitted; manifest
  // contents and driver errors never reach stdout.
  console.log(JSON.stringify(summary))
}

function readManifest(path: string): unknown | undefined {
  try {
    const stats = statSync(path)
    if (!stats.isFile() || stats.size > MAX_MANIFEST_BYTES) return undefined
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

async function main(): Promise<number> {
  const manifestPath = readOption('--manifest')
  const apply = process.argv.includes('--apply')
  const reviewedFingerprint = readOption('--fingerprint')

  if (!manifestPath) {
    report({ status: 'failed', errorCode: 'MANIFEST_PATH_REQUIRED' })
    return 1
  }

  const rawManifest = readManifest(manifestPath)
  if (rawManifest === undefined) {
    report({ status: 'failed', errorCode: 'MANIFEST_UNREADABLE' })
    return 1
  }

  const validation = validateImportedKbSourcesManifest(rawManifest)
  if (!validation.ok) {
    report({ status: 'failed', errorCode: validation.errorCode })
    return 1
  }

  if (!apply) {
    report({
      status: 'validated',
      fingerprint: validation.fingerprint,
      sourceCount: validation.manifest.sources.length,
    })
    return 0
  }

  if (!reviewedFingerprint) {
    report({ status: 'failed', errorCode: 'FINGERPRINT_REQUIRED' })
    return 1
  }

  // Compared before the client is loaded, so a stale or unreviewed fingerprint
  // can never reach a database connection.
  if (reviewedFingerprint !== validation.fingerprint) {
    report({ status: 'failed', errorCode: 'FINGERPRINT_MISMATCH' })
    return 1
  }

  // Loaded only on the apply path; offline validation stays connection-free.
  const { prisma } = await import('@klicker-uzh/prisma')
  try {
    const result = await registerImportedKbSources({
      prisma,
      input: rawManifest,
      reviewedFingerprint,
    })
    if (!result.ok) {
      report({ status: 'failed', errorCode: result.errorCode })
      return 1
    }
    report({
      status: result.status,
      fingerprint: result.fingerprint,
      insertedCount: result.insertedCount,
      existingCount: result.existingCount,
    })
    return 0
  } catch {
    report({ status: 'failed', errorCode: 'REGISTRATION_FAILED' })
    return 1
  } finally {
    await prisma.$disconnect()
  }
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode
  },
  () => {
    report({ status: 'failed', errorCode: 'REGISTRATION_FAILED' })
    process.exitCode = 1
  }
)
