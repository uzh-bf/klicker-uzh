import type { AggregateScope } from './aggregateCostReconciliation.js'

export const GATEWAY_COST_PAGE_SIZE = 100
export const GATEWAY_COST_MAX_PAGES = 1000

export type CostJsonRequester = (
  url: string,
  headers: Record<string, string>
) => Promise<unknown>

export function buildLiteLLMSpendRequest(
  scope: AggregateScope,
  host: string,
  authorization: string,
  page: number
) {
  const params = new URLSearchParams({
    start_date: scope.from.slice(0, 10),
    end_date: litellmEndDate(scope.to),
    team_id: scope.teamId,
    page: String(page),
    page_size: String(GATEWAY_COST_PAGE_SIZE),
    sort_by: 'startTime',
    sort_order: 'asc',
  })

  return {
    url: `${host.replace(/\/$/, '')}/spend/logs/v2?${params.toString()}`,
    headers: { 'x-litellm-api-key': authorization },
  }
}

export async function loadLiteLLMCostRows(
  scope: AggregateScope,
  host: string,
  authorization: string,
  requestJson: CostJsonRequester
) {
  const rows: unknown[] = []

  for (let page = 1; page <= GATEWAY_COST_MAX_PAGES; page += 1) {
    const request = buildLiteLLMSpendRequest(
      scope,
      host,
      authorization,
      page
    )
    const payload = await requestJson(request.url, request.headers)
    const pageRows = responseRows(payload)
    rows.push(...pageRows)

    const totalPages = readTotalPages(payload)
    if (
      pageRows.length < GATEWAY_COST_PAGE_SIZE ||
      (totalPages !== null && page >= totalPages)
    ) {
      return rows
    }
  }

  throw new Error('LiteLLM cost evidence exceeded the page safety limit.')
}

function responseRows(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('LiteLLM spend response must be an object.')
  }

  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) {
    throw new Error('LiteLLM spend response data must be an array.')
  }
  return data
}

function readTotalPages(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const object = payload as { total_pages?: unknown; totalPages?: unknown }
  const totalPages = Number(object.total_pages ?? object.totalPages)
  return Number.isInteger(totalPages) && totalPages >= 0 ? totalPages : null
}

function litellmEndDate(isoTimestamp: string) {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Gateway cost window must use valid UTC timestamps.')
  }

  // A midnight half-open boundary does not need the following calendar day;
  // fetching it can make the LiteLLM spend response too large to serve.
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return date.toISOString().slice(0, 10)
  }

  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
