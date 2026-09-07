import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FINANCEWIKI_KB_ID } from './financewiki-attachment.js'
import { verifyFinanceWikiAttachmentFixture } from './financewiki-attachment-fixture.js'

async function writeConsumer(overrides: Record<string, unknown> = {}) {
  const directory = await mkdtemp(
    join(tmpdir(), 'financewiki-attachment-fixture-')
  )
  const path = join(directory, 'consumer.json')
  await writeFile(
    path,
    JSON.stringify({
      schema_version: 1,
      producer_sha256: 'a'.repeat(64),
      catalog_name: 'financewiki_public_web',
      project_id: 'catalog-financewiki',
      collection: 'klicker_course_materials_v1',
      kb_id: FINANCEWIKI_KB_ID,
      resource_active: true,
      tool_name: 'doc_query',
      records: [{ record_id: 'financewiki.example.edu:mediawiki-101' }],
      ...overrides,
    })
  )
  return path
}

describe('FinanceWiki cross-repository attachment fixture', () => {
  it('plans every existing mode through one server and tool', async () => {
    const proof = await verifyFinanceWikiAttachmentFixture(
      await writeConsumer(),
      'a'.repeat(64)
    )

    expect(proof).toMatchObject({
      status: 'proof',
      server_name: 'KB',
      server_count: 1,
      config_count: 2,
      one_tool_per_config: true,
      existing_tool_name: 'doc_query',
      plan: {
        status: 'ready',
        targetCount: 2,
        modeCount: 2,
        wouldAttach: 2,
      },
      proof: {
        uses_production_planner: true,
        covers_every_enabled_mode: true,
        creates_server_or_config: false,
        writes_database_or_receipt: false,
      },
    })
  })

  it('rejects upstream identity drift', async () => {
    await expect(
      verifyFinanceWikiAttachmentFixture(
        await writeConsumer({ collection: 'catalog_financewiki_v1' }),
        'a'.repeat(64)
      )
    ).rejects.toThrow('collection drifted')
  })
})
