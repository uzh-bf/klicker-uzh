import { afterEach, expect, it, vi } from 'vitest'
import { loadCourseImageUrl } from '../src/lib/client/courseImageUrl'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('loads authorized bytes into a local URL, passing cancellation and cookies', async () => {
  const blob = new Blob(['png'], { type: 'image/png' })
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(blob))
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:figure')
  const signal = new AbortController().signal
  expect(await loadCourseImageUrl('/api/figure', signal)).toBe('blob:figure')
  expect(request).toHaveBeenCalledWith('/api/figure', {
    signal,
    credentials: 'same-origin',
  })
  expect(create).toHaveBeenCalledOnce()
})
it('never creates a preview for a denied request', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('', { status: 401 })
  )
  const create = vi.spyOn(URL, 'createObjectURL')
  await expect(
    loadCourseImageUrl('/api/figure', new AbortController().signal)
  ).rejects.toThrow('unavailable')
  expect(create).not.toHaveBeenCalled()
})
it('does not leak an object URL when navigation aborts during the download', async () => {
  const controller = new AbortController()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    controller.abort()
    return new Response('png')
  })
  const create = vi.spyOn(URL, 'createObjectURL')
  await expect(
    loadCourseImageUrl('/api/figure', controller.signal)
  ).rejects.toThrow()
  expect(create).not.toHaveBeenCalled()
})

it.each([
  '/api/figure',
  '/api/chatbots/b/threads/t/messages/m/frames/frame',
])('adds the scoped Bearer token without putting it in the URL: %s', async (src) => {
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) =>
      key === 'chat_participant_token' ? 'synthetic-guest' : null,
  })
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('png'))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:figure')
  await loadCourseImageUrl(src, new AbortController().signal)
  expect(request.mock.calls[0]?.[0]).toBe(src)
  expect(
    new Headers(request.mock.calls[0]?.[1]?.headers).get('Authorization')
  ).toBe('Bearer synthetic-guest')
})
