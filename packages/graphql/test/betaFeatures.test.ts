import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBetaFeatures,
  setBetaFeatures,
} from '../src/services/betaFeatures.js'
import type { ContextWithUser } from '../src/lib/context.js'

const USER_ID = 'lecturer-id'

const ctx = { user: { sub: USER_ID } } as ContextWithUser

function configure() {
  process.env.GROWTHBOOK_MANAGEMENT_API_URL = 'https://growthbook.test/'
  process.env.GROWTHBOOK_MANAGEMENT_API_KEY = 'secret_test'
  process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID = 'grp_test'
}

function unconfigure() {
  delete process.env.GROWTHBOOK_MANAGEMENT_API_URL
  delete process.env.GROWTHBOOK_MANAGEMENT_API_KEY
  delete process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID
}

function savedGroupResponse(values: string[], type = 'list') {
  return {
    json: async () => ({ savedGroup: { type, values } }),
    ok: true,
    status: 200,
  } as Response
}

describe('beta access opt-in', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    configure()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    unconfigure()
  })

  describe('getBetaFeatures', () => {
    it('reports membership in the saved group', async () => {
      fetchMock.mockResolvedValue(savedGroupResponse([USER_ID, 'someone-else']))
      await expect(getBetaFeatures({}, ctx)).resolves.toBe(true)
    })

    it('reports absence from the saved group', async () => {
      fetchMock.mockResolvedValue(savedGroupResponse(['someone-else']))
      await expect(getBetaFeatures({}, ctx)).resolves.toBe(false)
    })

    // `null` rather than `false` is what lets the settings page hide the switch
    // instead of telling a lecturer they are opted out when nobody knows.
    it('answers null when the integration is unconfigured', async () => {
      unconfigure()
      await expect(getBetaFeatures({}, ctx)).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('answers null when GrowthBook is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'))
      await expect(getBetaFeatures({}, ctx)).resolves.toBeNull()
    })

    it('answers null when the configured group is not a list group', async () => {
      fetchMock.mockResolvedValue(savedGroupResponse([], 'condition'))
      await expect(getBetaFeatures({}, ctx)).resolves.toBeNull()
    })
  })

  describe('setBetaFeatures', () => {
    it('adds the lecturer without disturbing the other members', async () => {
      fetchMock
        .mockResolvedValueOnce(savedGroupResponse(['someone-else']))
        .mockResolvedValueOnce(savedGroupResponse(['someone-else', USER_ID]))

      await expect(setBetaFeatures({ enabled: true }, ctx)).resolves.toBe(true)

      const writeCall = fetchMock.mock.calls[1]!
      expect(writeCall[0]).toBe(
        'https://growthbook.test/api/v1/saved-groups/grp_test'
      )
      expect(writeCall[1].method).toBe('POST')
      expect(JSON.parse(writeCall[1].body)).toEqual({
        bypassApproval: true,
        values: ['someone-else', USER_ID],
      })
    })

    it('does not duplicate an already-opted-in lecturer', async () => {
      fetchMock
        .mockResolvedValueOnce(savedGroupResponse([USER_ID]))
        .mockResolvedValueOnce(savedGroupResponse([USER_ID]))

      await setBetaFeatures({ enabled: true }, ctx)

      expect(JSON.parse(fetchMock.mock.calls[1]![1].body).values).toEqual([
        USER_ID,
      ])
    })

    it('removes only the lecturer opting out', async () => {
      fetchMock
        .mockResolvedValueOnce(savedGroupResponse(['someone-else', USER_ID]))
        .mockResolvedValueOnce(savedGroupResponse(['someone-else']))

      await expect(setBetaFeatures({ enabled: false }, ctx)).resolves.toBe(
        false
      )

      expect(JSON.parse(fetchMock.mock.calls[1]![1].body).values).toEqual([
        'someone-else',
      ])
    })

    // A silent no-op would leave the switch showing a state GrowthBook never
    // accepted, so both failure modes have to reach the lecturer.
    it('raises when the integration is unconfigured', async () => {
      unconfigure()
      await expect(setBetaFeatures({ enabled: true }, ctx)).rejects.toThrow(
        'not configured'
      )
    })

    it('raises when GrowthBook rejects the write', async () => {
      fetchMock
        .mockResolvedValueOnce(savedGroupResponse([]))
        .mockResolvedValueOnce({ ok: false, status: 403 } as Response)

      await expect(setBetaFeatures({ enabled: true }, ctx)).rejects.toThrow(
        'Failed to update beta access'
      )
    })
  })
})
