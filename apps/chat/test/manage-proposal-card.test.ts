import { describe, expect, test, vi } from 'vitest'
import { applyDismiss } from '../src/components/manage-proposal-card'
import {
  getManageProposalResult,
  isManageProposalResult,
} from '../src/services/manageProposalResult'
import {
  closeFenceMarker,
  openFenceMarker,
} from '../src/services/toolFenceSyntax'
import { fenceToolResultText } from '../src/services/toolOutputFencing'

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

  // Regression: X4 output fencing wraps EVERY MCP tool result, the proposal
  // tool's included, so this is the shape the browser actually receives. A
  // bare JSON.parse throws on the marker line and the card silently vanishes.
  test('extracts proposal envelopes from fenced MCP text-content results', () => {
    const sentinel = '0c5d3973-bc42-4232-b72a-f820635ec6b0'

    expect(
      getManageProposalResult({
        content: [
          {
            text: fenceToolResultText(
              JSON.stringify(proposalEnvelope),
              sentinel
            ),
            type: 'text',
          },
        ],
        isError: false,
      })
    ).toEqual(proposalEnvelope)
  })

  test('does not unwrap an envelope whose closing sentinel disagrees', () => {
    const forged = `${openFenceMarker('real-sentinel')}\n${JSON.stringify(
      proposalEnvelope
    )}\n${closeFenceMarker('other-sentinel')}`

    expect(
      getManageProposalResult({ content: [{ text: forged, type: 'text' }] })
    ).toBe(null)
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

describe('Manage proposal card dismissal', () => {
  test('dismisses an idle proposal into the terminal dismissed state', () => {
    expect(applyDismiss({ type: 'idle' }, false)).toEqual({
      type: 'dismissed',
    })
  })

  test('dismisses a failed proposal into the terminal dismissed state', () => {
    expect(
      applyDismiss({ type: 'error', message: 'Draft creation failed' }, false)
    ).toEqual({ type: 'dismissed' })
  })

  test('is a no-op while the tool call is still running', () => {
    expect(applyDismiss({ type: 'idle' }, true)).toEqual({ type: 'idle' })
  })

  test('is a no-op while a confirm request is in flight', () => {
    expect(applyDismiss({ type: 'loading' }, false)).toEqual({
      type: 'loading',
    })
  })

  test('is a no-op once the draft was already created', () => {
    const success = {
      type: 'success' as const,
      element: { id: 1, name: 'Q1', status: 'DRAFT', type: 'SC' },
    }
    expect(applyDismiss(success, false)).toEqual(success)
  })

  test('dismissed is terminal — dismissing again stays dismissed', () => {
    expect(applyDismiss({ type: 'dismissed' }, false)).toEqual({
      type: 'dismissed',
    })
  })
})
