import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthenticatedManageUser: vi.fn(),
  getManageAiCapability: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/src/components/manage-assistant', () => ({
  ManageAssistant: () => null,
}))
vi.mock('@/src/lib/server/featureFlags', () => ({
  getManageAiCapability: mocks.getManageAiCapability,
}))
vi.mock('@/src/lib/server/manageAuth', () => ({
  getAuthenticatedManageUser: mocks.getAuthenticatedManageUser,
}))

import ManageAssistantPage from '@/src/app/manage/page'

describe('Manage assistant page AI boundary', () => {
  beforeEach(() => {
    mocks.getAuthenticatedManageUser.mockReset()
    mocks.getAuthenticatedManageUser.mockResolvedValue({
      catalyst: true,
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    })
    mocks.getManageAiCapability.mockReset()
    mocks.notFound.mockClear()
  })

  test('keeps explicit denial as the existing not-found response', async () => {
    mocks.getManageAiCapability.mockResolvedValue('disabled')

    await expect(ManageAssistantPage({})).rejects.toThrow('NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  test('renders a dedicated state for temporary unavailability', async () => {
    mocks.getManageAiCapability.mockResolvedValue('temporarilyUnavailable')

    const page = await ManageAssistantPage({})

    expect(renderToStaticMarkup(page)).toContain(
      'data-cy="manage-ai-temporarily-unavailable"'
    )
    expect(mocks.notFound).not.toHaveBeenCalled()
  })
})
