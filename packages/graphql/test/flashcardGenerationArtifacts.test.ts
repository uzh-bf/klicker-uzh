import { readFileSync } from 'node:fs'
import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { generatedFlashcardElementInput } from '../src/services/elements.js'
import {
  parseFlashcardGenerationBank,
  parseFlashcardGenerationResult,
  parseTerminalFlashcardGenerationBank,
} from '../src/services/flashcardGenerationArtifacts.js'

const FIXTURE = readFileSync(
  new URL(
    './fixtures/questionGeneration/flashcard-bank-v1.json',
    import.meta.url
  )
)

const EXPECTED_BUILD = {
  graphVersionId: 'graph-version-1',
  graphManifest: {
    containerName: 'graph-artifacts',
    blobName: 'graphs/version-1/manifest.json',
    sha256: 'b'.repeat(64),
  },
  blueprint: {
    containerName: 'flashcard-artifacts',
    blobName: 'flashcards/blueprint.json',
    sha256: 'c'.repeat(64),
  },
  requestedFlashcardCount: 3,
  outputContainer: 'flashcard-artifacts',
  outputPrefix: 'flashcard-builds',
} as const

describe('flashcard-generation artifact boundary', () => {
  it('accepts the worker golden bank and keeps every card kind native', () => {
    const cards = parseFlashcardGenerationBank(FIXTURE, EXPECTED_BUILD)

    expect(cards.map((card) => card.cardType)).toEqual([
      'definition',
      'formula',
      'calculation',
    ])
    expect(cards.map(generatedFlashcardElementInput)).toEqual([
      expect.objectContaining({
        type: ElementType.FLASHCARD,
        status: ElementStatus.REVIEW,
        content: 'Was bedeutet Liquidität?',
      }),
      expect.objectContaining({
        type: ElementType.FLASHCARD,
        status: ElementStatus.REVIEW,
        explanation:
          '$Current\\ Ratio = Umlaufvermögen / kurzfristige\\ Verbindlichkeiten$',
      }),
      expect.objectContaining({
        type: ElementType.FLASHCARD,
        status: ElementStatus.REVIEW,
        content:
          'Das Umlaufvermögen beträgt 120 und die kurzfristigen Verbindlichkeiten 80. Wie hoch ist die Current Ratio?',
      }),
    ])
    expect(cards.map(generatedFlashcardElementInput)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: ElementType.NUMERICAL }),
      ])
    )
  })

  it('fails closed on incomplete, inconsistent, or detached banks', () => {
    const bank = JSON.parse(FIXTURE.toString('utf8'))
    const expected = EXPECTED_BUILD

    expect(() =>
      parseFlashcardGenerationBank(
        Buffer.from(JSON.stringify({ ...bank, status: 'incomplete' })),
        expected
      )
    ).toThrow(/complete/i)
    expect(() =>
      parseFlashcardGenerationBank(
        Buffer.from(JSON.stringify({ ...bank, accepted_flashcard_count: 2 })),
        expected
      )
    ).toThrow(/count/i)
    expect(() =>
      parseFlashcardGenerationBank(FIXTURE, {
        ...expected,
        graphVersionId: 'other-version',
      })
    ).toThrow(/graph version/i)
    expect(() =>
      parseFlashcardGenerationBank(FIXTURE, {
        ...expected,
        graphManifest: {
          ...expected.graphManifest,
          sha256: 'd'.repeat(64),
        },
      })
    ).toThrow(/graph manifest/i)
    expect(() =>
      parseFlashcardGenerationBank(FIXTURE, {
        ...expected,
        blueprint: {
          ...expected.blueprint,
          blobName: 'flashcards/other-blueprint.json',
        },
      })
    ).toThrow(/blueprint/i)
  })

  it('accepts multiline Markdown content but rejects unsafe controls', () => {
    const bank = JSON.parse(FIXTURE.toString('utf8'))
    bank.flashcards[0].back = 'Erste Zeile.\n\nZweite Zeile mit `$x$`.'

    expect(
      parseFlashcardGenerationBank(
        Buffer.from(JSON.stringify(bank)),
        EXPECTED_BUILD
      )[0]
    ).toMatchObject({ back: 'Erste Zeile.\n\nZweite Zeile mit `$x$`.' })

    bank.flashcards[0].back = 'Ungültig\u0000'
    expect(() =>
      parseFlashcardGenerationBank(
        Buffer.from(JSON.stringify(bank)),
        EXPECTED_BUILD
      )
    ).toThrow(/complete flashcard-bank-v1/i)
  })

  it('rejects worker paths hidden in passthrough metadata', () => {
    const bank = JSON.parse(FIXTURE.toString('utf8'))
    bank.metadata.blueprint.content = {
      source: { path: '/tmp/worker/blueprint.json' },
    }

    expect(() =>
      parseFlashcardGenerationBank(
        Buffer.from(JSON.stringify(bank)),
        EXPECTED_BUILD
      )
    ).toThrow(/complete flashcard-bank-v1/i)
  })

  it('fences a terminal result manifest to its build and artifacts', () => {
    const manifest = {
      schema_version: 1,
      flashcard_build_id: '00000000-0000-4000-8000-000000000002',
      graph_version_id: EXPECTED_BUILD.graphVersionId,
      graph_manifest: {
        container_name: EXPECTED_BUILD.graphManifest.containerName,
        blob_name: EXPECTED_BUILD.graphManifest.blobName,
        sha256: EXPECTED_BUILD.graphManifest.sha256,
      },
      blueprint: {
        container_name: EXPECTED_BUILD.blueprint.containerName,
        blob_name: EXPECTED_BUILD.blueprint.blobName,
        sha256: EXPECTED_BUILD.blueprint.sha256,
      },
      status: 'completed_with_review',
      requested_flashcards: 3,
      accepted_flashcards: 3,
      unresolved_flashcards: 0,
      warning_count: 1,
      flashcard_bank: {
        container_name: 'flashcard-artifacts',
        blob_name:
          'flashcard-builds/00000000-0000-4000-8000-000000000002/flashcards/bank.json',
        sha256: 'd'.repeat(64),
      },
      checkpoint_snapshot: null,
      reviewed_by: null,
    }
    const result = parseFlashcardGenerationResult(
      Buffer.from(JSON.stringify(manifest)),
      {
        buildId: '00000000-0000-4000-8000-000000000002',
        ...EXPECTED_BUILD,
      }
    )

    expect(result).toMatchObject({
      status: 'completed_with_review',
      warningCount: 1,
      acceptedFlashcards: 3,
      unresolvedFlashcards: 0,
    })
    expect(() =>
      parseFlashcardGenerationResult(
        Buffer.from(
          JSON.stringify({
            ...manifest,
            flashcard_bank: {
              ...manifest.flashcard_bank,
              blob_name: 'flashcard-builds/another-build/flashcards/bank.json',
            },
          })
        ),
        {
          buildId: '00000000-0000-4000-8000-000000000002',
          ...EXPECTED_BUILD,
        }
      )
    ).toThrow(/coordinates/i)
  })

  it('accepts only explicitly published incomplete banks at the terminal seam', () => {
    const bank = JSON.parse(FIXTURE.toString('utf8'))
    bank.status = 'incomplete'
    bank.accepted_flashcard_count = 2
    bank.unresolved_flashcard_count = 1
    bank.flashcards = bank.flashcards.slice(0, 2)
    bank.unresolved_slots = [
      {
        id: 'fc-M1-003',
        module: { module_id: 'M1', module_name: 'All material' },
        lernziel: {
          objective_id: '',
          objective_text: '',
          objective_source: 'module_fallback',
        },
        status: 'rejected',
        rejection: {
          stage: 'generation',
          reviewer_note: 'No accepted card was produced.',
          failed_at: null,
          attempts_exhausted: true,
        },
      },
    ]
    bank.metadata.publication = {
      status: 'incomplete',
      requested_flashcard_count: 3,
      accepted_flashcard_count: 2,
      unresolved_flashcard_count: 1,
      resumable: true,
      checkpoint_snapshot: {
        container_name: 'flashcard-artifacts',
        blob_name:
          'flashcard-builds/00000000-0000-4000-8000-000000000002/checkpoints/published.json',
        sha256: 'e'.repeat(64),
      },
    }

    const parsed = parseTerminalFlashcardGenerationBank(
      Buffer.from(JSON.stringify(bank)),
      {
        ...EXPECTED_BUILD,
        acceptedFlashcardCount: 2,
        unresolvedFlashcardCount: 1,
        publicationStatus: 'incomplete',
        checkpointSnapshot: {
          containerName: 'flashcard-artifacts',
          blobName:
            'flashcard-builds/00000000-0000-4000-8000-000000000002/checkpoints/published.json',
          sha256: 'e'.repeat(64),
        },
      }
    )

    expect(parsed.status).toBe('incomplete')
    expect(parsed.cards).toHaveLength(2)
    const detachedCheckpoint = structuredClone(bank)
    detachedCheckpoint.metadata.publication.checkpoint_snapshot.sha256 =
      'f'.repeat(64)
    expect(() =>
      parseTerminalFlashcardGenerationBank(
        Buffer.from(JSON.stringify(detachedCheckpoint)),
        {
          ...EXPECTED_BUILD,
          acceptedFlashcardCount: 2,
          unresolvedFlashcardCount: 1,
          publicationStatus: 'incomplete',
          checkpointSnapshot: {
            containerName: 'flashcard-artifacts',
            blobName:
              'flashcard-builds/00000000-0000-4000-8000-000000000002/checkpoints/published.json',
            sha256: 'e'.repeat(64),
          },
        }
      )
    ).toThrow(/checkpoint lineage/i)
    expect(() =>
      parseTerminalFlashcardGenerationBank(Buffer.from(JSON.stringify(bank)), {
        ...EXPECTED_BUILD,
        acceptedFlashcardCount: 3,
        unresolvedFlashcardCount: 0,
        publicationStatus: 'complete',
        checkpointSnapshot: null,
      })
    ).toThrow(/publication/i)
  })
})
