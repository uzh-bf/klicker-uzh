import assert from 'node:assert/strict'
import {
  buildLiteLLMSpendRequest,
  GATEWAY_COST_PAGE_SIZE,
  loadLiteLLMCostRows,
} from './litellmCostSource.js'

const scope = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-02T00:00:00.000Z',
  environment: 'prd',
  teamId: 'team-klicker',
}

function testRequestContract() {
  const request = buildLiteLLMSpendRequest(
    scope,
    'https://litellm.example/',
    'Bearer test-key',
    2
  )
  const url = new URL(request.url)

  assert.equal(url.pathname, '/spend/logs/v2')
  assert.equal(url.searchParams.get('start_date'), '2026-08-01')
  assert.equal(url.searchParams.get('end_date'), '2026-08-02')
  assert.equal(url.searchParams.get('team_id'), 'team-klicker')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(
    url.searchParams.get('page_size'),
    String(GATEWAY_COST_PAGE_SIZE)
  )
  assert.equal(url.searchParams.get('sort_by'), 'startTime')
  assert.equal(url.searchParams.get('sort_order'), 'asc')
  assert.deepEqual(request.headers, {
    'x-litellm-api-key': 'Bearer test-key',
  })
}

async function testPaginationStopsAtReportedLastPage() {
  const requests: string[] = []
  const requestJson = async (url: string) => {
    requests.push(url)
    const page = requests.length
    return {
      data:
        page === 1
          ? Array.from({ length: GATEWAY_COST_PAGE_SIZE }, (_, index) => ({
              request_id: `request-${index}`,
            }))
          : [{ request_id: 'request-last' }],
      page,
      page_size: GATEWAY_COST_PAGE_SIZE,
      total_pages: 2,
    }
  }

  const rows = await loadLiteLLMCostRows(
    scope,
    'https://litellm.example',
    'Bearer test-key',
    requestJson
  )

  assert.equal(requests.length, 2)
  assert.equal(rows.length, GATEWAY_COST_PAGE_SIZE + 1)
  assert.match(requests[1]!, /[?&]page=2(?:&|$)/)
}

testRequestContract()
await testPaginationStopsAtReportedLastPage()

console.log('LiteLLM cost source tests passed')
