#!/usr/bin/env node

import {
  createAzureAuditClients,
  readAzureAuditStorageConfig,
} from '../azure/credential.js'
import { AzureTableAuditReader } from '../azure/table-reader.js'
import { AzureAuditManifestStore } from '../sealing/manifest.js'
import { parseArguments } from './arguments.js'
import {
  buildAuditExport,
  serializeAuditExport,
  writePrivateAtomicFile,
} from './export.js'

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const clients = createAzureAuditClients(readAzureAuditStorageConfig())
  const reader = new AzureTableAuditReader(clients.tables)
  if (args.command === 'verify') {
    const evidence = await reader.verifyEvent(args.eventId!)
    const report = await buildAuditExport({
      reader,
      manifests: new AzureAuditManifestStore(clients.blobs.manifests),
      liveQuizId: evidence.envelope.scope.liveQuizId,
      lifecycleEpoch: evidence.envelope.scope.lifecycleEpoch,
    })
    const isMember = report.manifests?.some(({ manifest }) =>
      manifest.events.some((event) => event.eventId === args.eventId)
    )
    let sealStatus: 'INVALID' | 'SEALED' | 'UNSEALED' = 'UNSEALED'
    if (report.verification.sealStatus === 'INVALID') sealStatus = 'INVALID'
    else if (isMember) sealStatus = 'SEALED'
    process.stdout.write(
      `${JSON.stringify({
        eventId: evidence.envelope.eventId,
        eventHash: evidence.envelope.eventHash,
        eventType: evidence.envelope.eventType,
        recordedAt: evidence.envelope.recordedAt,
        status: evidence.status,
        sealStatus,
        sealFailures: report.verification.sealFailures,
      })}\n`
    )
    if (sealStatus === 'INVALID') process.exitCode = 1
    return
  }

  const document = await buildAuditExport({
    reader,
    manifests: new AzureAuditManifestStore(clients.blobs.manifests),
    liveQuizId: args.liveQuizId!,
    lifecycleEpoch: args.lifecycleEpoch,
    participantId: args.participantId,
  })
  if (document.verification.sealStatus === 'INVALID') process.exitCode = 1
  const outputPath = await writePrivateAtomicFile({
    outputPath: args.output!,
    content: serializeAuditExport(document),
    force: args.force,
  })
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      eventCount: document.verification.eventCount,
      evidenceStatus: document.verification.evidenceStatus,
      baselineStatus: document.verification.baselineStatus,
      coverageStatus: document.verification.coverageStatus,
      participantStatus: document.verification.participantStatus,
      sealStatus: document.verification.sealStatus,
    })}\n`
  )
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
})
