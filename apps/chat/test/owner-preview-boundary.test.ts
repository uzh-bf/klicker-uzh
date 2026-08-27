import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const routeSource = readFileSync(
  new URL(
    '../src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts',
    import.meta.url
  ),
  'utf8'
)

describe('owner preview persistence boundary', () => {
  it('does not depend on participant or persisted conversation services', () => {
    expect(routeSource).not.toContain('withChatbotAuth')
    expect(routeSource).not.toContain('ThreadService')
    expect(routeSource).not.toContain('accountUsage')
    expect(routeSource).not.toMatch(
      /prisma\.(chatThread|chatMessage|participant)/
    )
  })
})
