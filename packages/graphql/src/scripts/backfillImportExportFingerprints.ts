import { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  refreshAnswerCollectionImportFingerprint,
  refreshElementImportFingerprint,
} from '../services/importExportFingerprints.js'

const BATCH_SIZE = 500

async function refreshInChunks(
  ids: number[],
  refresh: (id: number) => Promise<unknown>
) {
  const chunkSize = 25
  for (let index = 0; index < ids.length; index += chunkSize) {
    await Promise.all(ids.slice(index, index + chunkSize).map(refresh))
  }
}

async function backfillAnswerCollections(prisma: PrismaClient) {
  let total = 0

  while (true) {
    const collections = await prisma.answerCollection.findMany({
      where: {
        isDeleted: false,
        importFingerprint: null,
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    })

    if (collections.length === 0) {
      return total
    }

    await refreshInChunks(
      collections.map((collection) => collection.id),
      (id) => refreshAnswerCollectionImportFingerprint(id, prisma)
    )
    total += collections.length
    console.log(
      `[ImportExportFingerprintBackfill] Answer collections: ${total}`
    )
  }
}

async function backfillElements(prisma: PrismaClient) {
  let total = 0

  while (true) {
    const elements = await prisma.element.findMany({
      where: {
        isDeleted: false,
        importFingerprint: null,
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    })

    if (elements.length === 0) {
      return total
    }

    await refreshInChunks(
      elements.map((element) => element.id),
      (id) => refreshElementImportFingerprint(id, prisma)
    )
    total += elements.length
    console.log(`[ImportExportFingerprintBackfill] Elements: ${total}`)
  }
}

async function run() {
  const prisma = new PrismaClient()

  try {
    const [answerCollections, elements] = await Promise.all([
      backfillAnswerCollections(prisma),
      backfillElements(prisma),
    ])

    console.log(
      `[ImportExportFingerprintBackfill] Completed answerCollections=${answerCollections} elements=${elements}`
    )
  } finally {
    await prisma.$disconnect()
  }
}

run().catch((error) => {
  console.error('[ImportExportFingerprintBackfill] FAILED', error)
  process.exit(1)
})
