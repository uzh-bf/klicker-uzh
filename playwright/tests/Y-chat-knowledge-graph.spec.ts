import { expect, test } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  chatUrl,
  getEnrolledParticipantId,
  setParticipantToken,
} from '../util/chat.js'

// Opt in after publishing the synthetic native graph with seed-graph-e2e.mjs.
// The host launcher must preserve that disposable database between setup and test.
test('Native knowledge graph exploration and lecturer visibility policy', async ({
  page,
}) => {
  test.skip(
    !process.env.GRAPH_RETRIEVAL_TEST_PORT,
    'Requires local FalkorDB fixture'
  )
  const prisma = await getPrisma()
  const policy = await prisma.chatbot.findUniqueOrThrow({
    where: { id: CHATBOT_ID },
    select: {
      knowledgeGraphVisible: true,
      knowledgeGraphRetrievalEnabled: true,
    },
  })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/knowledge-graph?'))
      requests.push(request.url())
  })
  await setParticipantToken(page, await getEnrolledParticipantId())
  await prisma.chatbot.update({
    where: { id: CHATBOT_ID },
    data: { knowledgeGraphVisible: true },
  })
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/graph`)
    const accept = page.getByTestId('chat-disclaimer-accept')
    await expect(
      page.getByTestId('knowledge-graph-search').or(accept)
    ).toBeVisible()
    if (await accept.isVisible()) await accept.click()
    const search = page.getByTestId('knowledge-graph-search')
    await expect(search).toBeVisible()
    expect(
      requests.some(
        (url) => new URL(url).searchParams.get('operation') === 'overview'
      )
    ).toBe(false)
    await search.fill('Diversification')
    await search.press('Enter')
    const neighbor = page
      .getByTestId('knowledge-graph-loaded-node')
      .filter({ hasText: 'Covariance' })
    await expect(neighbor).toBeVisible()
    await neighbor.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('knowledge-graph-details')).toBeVisible()
    await page.getByTestId('knowledge-graph-expand').click()
    await expect(
      page
        .getByTestId('knowledge-graph-loaded-node')
        .filter({ hasText: 'Portfolio risk' })
    ).toBeVisible()
    expect(
      requests.some(
        (url) => new URL(url).searchParams.get('operation') === 'neighbors'
      )
    ).toBe(true)

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect
        .poll(async () => {
          const bounds = await page
            .getByTestId('knowledge-graph-details')
            .boundingBox()
          return (
            bounds !== null &&
            bounds.x >= 0 &&
            bounds.x + bounds.width <= width + 1
          )
        })
        .toBe(true)
    }

    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { knowledgeGraphVisible: false },
    })
    const denied = await page.request.get(
      `${chatUrl()}/api/chatbots/${CHATBOT_ID}/knowledge-graph?operation=overview`
    )
    expect(denied.status()).toBe(403)
    expect((await denied.json()).code).toBe('KNOWLEDGE_GRAPH_DISABLED')
    await page.reload()
    await expect(page.getByTestId('knowledge-graph-mode-link')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-viewer')).toHaveCount(0)
    const after = await prisma.chatbot.findUniqueOrThrow({
      where: { id: CHATBOT_ID },
      select: { knowledgeGraphRetrievalEnabled: true },
    })
    expect(after.knowledgeGraphRetrievalEnabled).toBe(
      policy.knowledgeGraphRetrievalEnabled
    )
  } finally {
    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { knowledgeGraphVisible: policy.knowledgeGraphVisible },
    })
  }
})
