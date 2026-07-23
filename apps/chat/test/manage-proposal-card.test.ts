import { describe, expect, test, vi } from 'vitest'
import {
  getManageProposalResult,
  isManageProposalResult,
} from '../src/components/manage-proposal-card'

// manage-proposal-card.tsx renders the preview through shared-components,
// which pulls in @uzh-bf/design-system's CSS entrypoint. That CSS import
// cannot be resolved by Vitest's node-environment module graph (Vite's CSS
// handling for externalized deps only works under the vmThreads pool), so
// mock the preview module before it is ever evaluated. These tests only
// exercise the pure envelope-parsing helpers below, not rendering.
vi.mock('../src/components/manage-proposal-preview', () => ({
  ManageProposalPreview: () => null,
}))

const proposalEnvelope = {
  kind: 'element.create.proposal',
  proposalToken: 'signed-token',
  summary: 'Create a draft question',
  requiresConfirmation: true,
  payload: { type: 'SC' },
}

describe('Manage proposal card', () => {
  test('recognizes confirmation proposal envelopes', () => {
    expect(isManageProposalResult(proposalEnvelope)).toBe(true)
  })

  test('extracts proposal envelopes from MCP text-content results', () => {
    expect(
      getManageProposalResult({
        content: [
          {
            text: JSON.stringify(proposalEnvelope),
            type: 'text',
          },
        ],
        isError: false,
      })
    ).toEqual(proposalEnvelope)
  })

  test('rejects arbitrary tool output', () => {
    expect(isManageProposalResult({ ok: true })).toBe(false)
    expect(getManageProposalResult({ content: [{ text: 'not json' }] })).toBe(
      null
    )
    expect(
      isManageProposalResult({
        kind: 'element.create',
        proposalToken: 123,
        requiresConfirmation: true,
        payload: {},
      })
    ).toBe(false)
    expect(isManageProposalResult(null)).toBe(false)
  })
})
