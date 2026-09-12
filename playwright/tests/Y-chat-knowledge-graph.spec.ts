import { expect, test, type Page, type Route } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  chatUrl,
  getEnrolledParticipantId,
  seedThread,
  setDisclaimerState,
  setParticipantToken,
  testImageUpload,
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
    ).toBe(true)
    // Derive the expected canvas size from the loaded overview instead of
    // pinning the seeded fixture's concept count.
    await expect
      .poll(() => page.getByTestId('knowledge-graph-loaded-node').count())
      .toBeGreaterThan(0)
    const overviewNodeCount = await page
      .getByTestId('knowledge-graph-loaded-node')
      .count()
    const beforeTyping = requests.length
    await search.fill('Co')
    await search.fill('Cov')
    const option = page.getByRole('option').filter({ hasText: 'Covariance' })
    await expect(option).toBeVisible()
    expect(
      requests
        .slice(beforeTyping)
        .some((url) => new URL(url).searchParams.get('q') === 'Co')
    ).toBe(false)
    await expect(page.getByTestId('knowledge-graph-loaded-node')).toHaveCount(
      overviewNodeCount
    )
    expect(
      requests
        .slice(beforeTyping)
        .every((url) => new URL(url).searchParams.get('operation') === 'search')
    ).toBe(true)
    await search.press('ArrowDown')
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

    const neighborRequest = [...requests]
      .reverse()
      .find((url) => new URL(url).searchParams.get('operation') === 'neighbors')
    expect(neighborRequest).toBeDefined()
    const origin = new URL(neighborRequest!)
    expect(origin.searchParams.get('kbId')).toBeTruthy()
    expect(origin.searchParams.get('buildId')).toBeTruthy()
    origin.searchParams.set('buildId', '99999999-9999-4999-8999-999999999999')
    const changedBuild = await page.request.get(origin.toString())
    expect(changedBuild.status()).toBe(409)
    expect((await changedBuild.json()).code).toBe(
      'KNOWLEDGE_GRAPH_BUILD_CHANGED'
    )

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

    await page.getByTestId('knowledge-graph-back-to-overview').click()
    await expect(page.getByTestId('knowledge-graph-loaded-node')).toHaveCount(
      overviewNodeCount
    )
    await expect(search).toHaveValue('')
    await expect(page.getByTestId('knowledge-graph-details')).toHaveCount(0)
    await search.fill('Div')
    await expect(page.getByRole('option')).toBeVisible()
    await search.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-loaded-node')).toHaveCount(
      overviewNodeCount
    )
    await search.fill('D')
    await search.press('Enter')
    await expect(page.getByTestId('knowledge-graph-details')).toBeVisible()

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

// ===========================================================================
// Suggestion request lifecycle (hermetic, browser-fulfilled responses)
// ===========================================================================

/** The suggestion debounce the viewer uses; waits below outlive it. */
const SUGGESTION_DEBOUNCE_MS = 300

const SUGGESTION_KB_ID = 'e2e-suggestion-kb'
const SUGGESTION_BUILD_ID = 'e2e-suggestion-build'

function syntheticNode(label: string) {
  return {
    id: `node:${label}`,
    labels: ['Concept'],
    kind: 'Concept',
    displayLabel: label,
    degree: 0,
    sourceReferences: [],
  }
}

function syntheticGraphResponse(labels: string[]) {
  return {
    kbId: SUGGESTION_KB_ID,
    buildId: SUGGESTION_BUILD_ID,
    isStale: false,
    truncated: false,
    nodes: labels.map(syntheticNode),
    edges: [],
  }
}

/**
 * Browser-side stand-in for the knowledge graph API.
 *
 * Suggestion responses are held until the test releases them, so the debounce
 * and in-flight rules become observable states instead of races. The controller
 * also records every suggestion query the browser actually sent and the highest
 * number of suggestion requests that were open at the same time. Each label
 * carries its own query, which identifies the response that rendered without
 * depending on product or seed content.
 */
function createKnowledgeGraphRoute(overviewLabels: string[]) {
  const releases = new Map<string, () => void>()
  const queries: string[] = []
  let inFlight = 0
  let maxInFlight = 0

  const waitForQuery = async (query: string) => {
    await expect.poll(() => queries.includes(query)).toBe(true)
  }

  const release = (query: string) => {
    const releaseQuery = releases.get(query)
    releases.delete(query)
    releaseQuery?.()
  }

  const handle = async (route: Route) => {
    const url = new URL(route.request().url())
    const operation = url.searchParams.get('operation')
    const fulfil = (labels: string[]) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(syntheticGraphResponse(labels)),
      })

    if (operation === 'overview') {
      await fulfil(overviewLabels)
      return
    }
    if (operation !== 'search') {
      // Selecting a concept asks for its neighborhood; an empty one keeps the
      // canvas on the selected response.
      await fulfil([])
      return
    }

    const query = url.searchParams.get('q') ?? ''
    queries.push(query)
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    try {
      await new Promise<void>((resolve) => releases.set(query, resolve))
      await fulfil([`Suggestion:${query}`])
    } finally {
      inFlight -= 1
    }
  }

  return {
    /** Suggestion queries the browser actually sent, in arrival order. */
    queries,
    /** Highest number of suggestion requests open at the same time. */
    get maxInFlight() {
      return maxInFlight
    },
    waitForQuery,
    release,
    handle,
  }
}

async function openSuggestionGraph(
  page: Page,
  graph: ReturnType<typeof createKnowledgeGraphRoute>
) {
  await page.route('**/api/chatbots/*/knowledge-graph**', (route) =>
    graph.handle(route)
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${chatUrl()}/${CHATBOT_ID}/graph`)

  const accept = page.getByTestId('chat-disclaimer-accept')
  const search = page.getByTestId('knowledge-graph-search')
  await expect(search.or(accept)).toBeVisible()
  if (await accept.isVisible()) await accept.click()
  await expect(search).toBeVisible()
  await expect
    .poll(() => page.getByTestId('knowledge-graph-loaded-node').count())
    .toBeGreaterThan(0)
  return search
}

test.describe('Knowledge graph suggestion request lifecycle', () => {
  const overviewLabels = ['Overview one', 'Overview two', 'Overview three']
  let previousVisibility: boolean | null = null

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    const chatbot = await prisma.chatbot.findUniqueOrThrow({
      where: { id: CHATBOT_ID },
      select: { knowledgeGraphVisible: true },
    })
    previousVisibility = chatbot.knowledgeGraphVisible
  })

  test.afterAll(async () => {
    if (previousVisibility === null) return
    const prisma = await getPrisma()
    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { knowledgeGraphVisible: previousVisibility },
    })
  })

  test.beforeEach(async ({ page }) => {
    const prisma = await getPrisma()
    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { knowledgeGraphVisible: true },
    })
    const participantId = await getEnrolledParticipantId()
    await setDisclaimerState(participantId, 'accepted')
    await setParticipantToken(page, participantId)
  })

  test('docked graph preserves the draft and attachments; fullscreen restores focus and inserts without sending', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    await page.route('**/api/chatbots/*/knowledge-graph**', (route) =>
      graph.handle(route)
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    const thread = await seedThread(await getEnrolledParticipantId(), {
      title: 'Graph exploration',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'A previous question' }],
        },
      ],
    })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
    const input = page.getByTestId('chat-composer-input')
    await expect(input).toBeVisible()
    await input.fill('My unfinished question')
    await page
      .getByTestId('chat-composer-attach-input')
      .setInputFiles(testImageUpload())
    const url = page.url()
    const sent: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/(chat|threads)(?:\?|$)/.test(request.url())
      )
        sent.push(request.url())
    })
    const toggle = page.getByTestId('knowledge-graph-mode-link')
    await expect(page.getByTestId('chat-knowledge-graph-panel')).toHaveCount(0)
    await toggle.click()
    const panel = page.getByTestId('chat-knowledge-graph-panel')
    await expect(panel).toBeVisible()
    await expect(input).toHaveValue('My unfinished question')
    await expect(page.getByTestId('chat-composer-attachment')).toHaveCount(1)
    const conversation = await page
      .getByTestId('chat-conversation-pane')
      .boundingBox()
    const dock = await panel.boundingBox()
    expect(conversation!.x + conversation!.width).toBeLessThanOrEqual(
      dock!.x + 1
    )
    await page.getByTestId('knowledge-graph-loaded-node').first().click()
    const fullscreen = page.getByTestId('knowledge-graph-fullscreen')
    await fullscreen.click()
    await expect(panel).toHaveAttribute('data-fullscreen', 'true')
    await expect(page.getByTestId('knowledge-graph-details')).toBeVisible()
    expect(
      await input.evaluate((element) => Boolean(element.closest('[inert]')))
    ).toBe(true)
    await fullscreen.press('Shift+Tab')
    expect(
      await panel.evaluate((element) =>
        element.contains(document.activeElement)
      )
    ).toBe(true)
    await fullscreen.press('Escape')
    await expect(panel).toHaveAttribute('data-fullscreen', 'false')
    await expect(fullscreen).toBeFocused()
    await fullscreen.click()
    await page.getByTestId('knowledge-graph-ask').click()
    await expect(panel).toHaveAttribute('data-fullscreen', 'false')
    await expect(input).toBeFocused()
    const draft = await input.inputValue()
    expect(draft.startsWith('My unfinished question')).toBe(true)
    expect(draft).toContain(overviewLabels[0])
    expect(draft.length).toBeGreaterThan('My unfinished question'.length)
    await page.getByTestId('knowledge-graph-panel-close').click()
    await expect(toggle).toBeFocused()
    await expect(input).toHaveValue(draft)
    await expect(page.getByTestId('chat-composer-attachment')).toHaveCount(1)
    await toggle.click()
    expect(page.url()).toBe(url)
    expect(sent).toEqual([])
  })

  test('relation prompts include both labels and mobile asking returns to the composer', async ({
    page,
  }) => {
    const nodes = ['First topic', 'Second topic'].map(syntheticNode)
    await page.route('**/api/chatbots/*/knowledge-graph**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...syntheticGraphResponse([]),
          nodes,
          edges: [
            {
              id: '1',
              source: nodes[0]!.id,
              target: nodes[1]!.id,
              type: 'RELATED',
              label: 'connects',
              properties: {},
            },
          ],
        }),
      })
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/graph?embed=true`)
    const input = page.getByTestId('chat-composer-input')
    await expect(input).toBeVisible()
    const sent: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/chat'))
        sent.push(request.url())
    })
    await page
      .getByTestId('knowledge-graph-loaded-relationship')
      .first()
      .click()
    await page.getByTestId('knowledge-graph-ask').click()
    await expect(input).toBeFocused()
    await expect(page.getByTestId('chat-knowledge-graph-panel')).toHaveCount(0)
    const draft = await input.inputValue()
    for (const node of nodes) expect(draft).toContain(node.displayLabel)
    expect(draft).toContain('connects')
    expect(sent).toEqual([])
    expect(page.url()).toContain('?embed=true')
  })

  test('closing the panel cancels its debounce and drops late suggestions', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)
    await search.fill('Closed')
    await page.getByTestId('knowledge-graph-panel-close').click()
    await page.waitForTimeout(400)
    expect(graph.queries).toEqual([])
    await page.getByTestId('knowledge-graph-mode-link').click()
    await search.fill('Late')
    await graph.waitForQuery('Late')
    await page.getByTestId('knowledge-graph-panel-close').click()
    graph.release('Late')
    await page.getByTestId('knowledge-graph-mode-link').click()
    await expect(search).toHaveValue('')
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(0)
  })

  test('a suggestion response for a superseded query never renders', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)

    await search.fill('Co')
    await graph.waitForQuery('Co')
    await search.fill('Cov')
    // The superseded response is only released after the newer input.
    graph.release('Co')
    await graph.waitForQuery('Cov')

    // 'Cov' is still held, so any option here could only come from the
    // superseded response.
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(0)

    graph.release('Cov')
    await expect(
      page
        .getByTestId('knowledge-graph-suggestion')
        .filter({ hasText: 'Suggestion:Cov' })
    ).toBeVisible()
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(1)
    expect(graph.queries).toEqual(['Co', 'Cov'])
  })

  test('blurring the input drops a late suggestion response', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)
    const overviewNodeCount = await page
      .getByTestId('knowledge-graph-loaded-node')
      .count()

    await search.fill('Blur')
    await graph.waitForQuery('Blur')
    await search.blur()
    graph.release('Blur')

    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-loaded-node')).toHaveCount(
      overviewNodeCount
    )
    expect(graph.queries).toEqual(['Blur'])
  })

  test('returning to the overview cancels a pending suggestion request', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)
    const overviewNodeCount = await page
      .getByTestId('knowledge-graph-loaded-node')
      .count()

    await search.fill('Pick')
    await graph.waitForQuery('Pick')
    graph.release('Pick')
    await page
      .getByTestId('knowledge-graph-suggestion')
      .filter({ hasText: 'Suggestion:Pick' })
      .click()

    const backToOverview = page.getByTestId('knowledge-graph-back-to-overview')
    await expect(backToOverview).toBeVisible()

    await search.fill('Late')
    await graph.waitForQuery('Late')
    await backToOverview.click()
    await expect(search).toHaveValue('')

    graph.release('Late')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-loaded-node')).toHaveCount(
      overviewNodeCount
    )
  })

  test('keeps one suggestion request in flight and only the latest pending input', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)
    const settled = () => page.waitForTimeout(SUGGESTION_DEBOUNCE_MS + 150)

    await search.fill('Al')
    await graph.waitForQuery('Al')
    // Each later input has to outlive its own debounce to reach the queue while
    // the first request is still open.
    await settled()
    await search.fill('Alg')
    await settled()
    await search.fill('Alge')
    await settled()

    expect(graph.queries).toEqual(['Al'])

    graph.release('Al')
    await graph.waitForQuery('Alge')
    graph.release('Alge')

    await expect(
      page
        .getByTestId('knowledge-graph-suggestion')
        .filter({ hasText: 'Suggestion:Alge' })
    ).toBeVisible()
    expect(graph.queries).toEqual(['Al', 'Alge'])
    expect(graph.maxInFlight).toBe(1)
  })

  test('suppresses suggestion requests while composing and schedules on composition end', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)

    await search.click()
    await search.dispatchEvent('compositionstart')
    // Composition updates the value in place, as an IME does.
    await search.fill('Co')
    await search.fill('Comp')
    await page.waitForTimeout(SUGGESTION_DEBOUNCE_MS * 2)

    // Nothing may be requested while the composition is open.
    expect(graph.queries).toEqual([])

    await search.dispatchEvent('compositionend', { data: 'Comp' })
    await graph.waitForQuery('Comp')
    expect(graph.queries).toEqual(['Comp'])
  })

  test('Escape during the debounce cancels the suggestion request', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)

    await search.fill('Esc')
    // Escape lands inside the 300 ms debounce window, before any request.
    await search.press('Escape')
    await page.waitForTimeout(SUGGESTION_DEBOUNCE_MS * 2)

    expect(graph.queries).toEqual([])
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByTestId('knowledge-graph-suggestion')).toHaveCount(0)
  })

  test('selecting a suggestion with the pointer replaces the view with its node', async ({
    page,
  }) => {
    const graph = createKnowledgeGraphRoute(overviewLabels)
    const search = await openSuggestionGraph(page, graph)

    await search.fill('Pointer')
    await graph.waitForQuery('Pointer')
    graph.release('Pointer')

    const option = page
      .getByTestId('knowledge-graph-suggestion')
      .filter({ hasText: 'Suggestion:Pointer' })
    await expect(option).toBeVisible()
    await option.click()

    await expect(
      page
        .getByTestId('knowledge-graph-loaded-node')
        .filter({ hasText: 'Suggestion:Pointer' })
    ).toBeVisible()
    await expect(
      page.getByTestId('knowledge-graph-back-to-overview')
    ).toBeVisible()
  })

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true })

    test('selecting a suggestion with a tap replaces the view with its node', async ({
      page,
    }) => {
      const graph = createKnowledgeGraphRoute(overviewLabels)
      const search = await openSuggestionGraph(page, graph)

      await search.fill('Tap')
      await graph.waitForQuery('Tap')
      graph.release('Tap')

      const option = page
        .getByTestId('knowledge-graph-suggestion')
        .filter({ hasText: 'Suggestion:Tap' })
      await expect(option).toBeVisible()
      await option.tap()

      await expect(
        page
          .getByTestId('knowledge-graph-loaded-node')
          .filter({ hasText: 'Suggestion:Tap' })
      ).toBeVisible()
    })
  })
})
