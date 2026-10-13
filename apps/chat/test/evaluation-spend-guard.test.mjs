import { strict as assert } from 'node:assert'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import {
  acquireBudgetLock,
  beginBudgetTurn,
  fingerprint,
  finishBudgetTurn,
  initializeBudget,
  readBudgetLedger,
  reserveProviderSpend,
} from '../../../evaluation/evaluation-budget.mjs'
import {
  createSpendGuard,
  requestReservation,
  validatePricingPolicy,
  verifyGuardQualification,
} from '../../../evaluation/evaluation-spend-guard.mjs'

const policy = {
  version: 1,
  provider: 'synthetic',
  qualification: 'fake upstream enforced bounds',
  upstreamOrigin: 'https://synthetic.example/v1',
  models: {
    'synthetic-model': {
      contextTokens: 1000,
      maxOutputTokens: 100,
      inputMicroUsdPerMillion: 1_000_000,
      outputMicroUsdPerMillion: 2_000_000,
      outputIncludesReasoning: true,
    },
  },
}
const request = {
  model: 'synthetic-model',
  input: 'synthetic input',
  max_output_tokens: 100,
  stream: true,
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return 'http://127.0.0.1:' + server.address().port
}
async function close(server) {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}

async function scenario(body, cap = 2400) {
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  const budgetFile = join(directory, 'budget.json')
  const calls = []
  const upstream = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    calls.push({
      url: req.url,
      headers: req.headers,
      body: JSON.parse(Buffer.concat(chunks)),
    })
    const ledger = await readBudgetLedger(budgetFile)
    assert.ok(ledger.reservedProviderMicroUsd >= 1200)
    if (calls.at(-1).body.instructions === 'fail') {
      res.writeHead(500)
      res.end('private upstream error')
    } else {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.end('data: synthetic\n\n')
    }
  })
  const upstreamOrigin = await listen(upstream)
  const qualifiedPolicy = { ...policy, upstreamOrigin: upstreamOrigin + '/v1' }
  await initializeBudget(budgetFile, fingerprint(qualifiedPolicy), {
    maxProviderMicroUsd: cap,
  })
  const guard = await createSpendGuard({
    policy: qualifiedPolicy,
    budgetFile,
    apiKey: 'synthetic-guard-key',
    upstreamKey: 'synthetic-upstream-key',
    upstreamOrigin: upstreamOrigin + '/v1',
  })
  const origin = await listen(guard)
  const release = await acquireBudgetLock(budgetFile, '.run')
  const send = (payload = request, headers = {}) =>
    fetch(origin + '/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-guard-key',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    })
  try {
    await body({
      directory,
      budgetFile,
      calls,
      origin,
      send,
      qualifiedPolicy,
      release,
    })
  } finally {
    await release()
    await close(guard)
    await close(upstream)
    await rm(directory, { recursive: true, force: true })
  }
}

test('guard reserves each step and retry durably before forwarding and never refunds failures', async () => {
  await scenario(async ({ budgetFile, send, calls }) => {
    const token = await beginBudgetTurn(budgetFile)
    const first = await send({ ...request, instructions: 'fail' })
    assert.equal(first.status, 502)
    assert.equal((await first.json()).error, 'provider_request_failed')
    const second = await send(request, { 'x-private': 'must not forward' })
    assert.equal(second.status, 200)
    assert.ok((await second.text()).includes('synthetic'))
    const third = await send()
    assert.equal(third.status, 429)
    assert.equal(calls.length, 2)
    assert.equal(calls[1].headers['x-private'], undefined)
    assert.equal(
      calls[1].headers.authorization,
      'Bearer synthetic-upstream-key'
    )
    const ledger = await finishBudgetTurn(budgetFile, token, 0.2)
    assert.equal(ledger.reservedProviderMicroUsd, 2400)
    assert.equal(ledger.submittedTurns, 1)
    assert.equal(ledger.creditsUsed, 0.2)
    assert.equal(ledger.uncertain, false)
  })
})

test('concurrent provider requests cannot dispatch beyond shared cap', async () => {
  await scenario(async ({ budgetFile, send, calls }) => {
    await beginBudgetTurn(budgetFile)
    const responses = await Promise.all([send(), send(), send()])
    await Promise.all(responses.map((response) => response.text()))
    assert.equal(calls.length, 1)
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 429, 429]
    )
    assert.equal(
      (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
      1200
    )
  }, 1200)
})

test('unpriced, unbounded, multiple-completion and paid-tool requests never reach upstream', async () => {
  validatePricingPolicy(policy)
  assert.equal(requestReservation(policy, '/v1/responses', request), 1200)
  await scenario(async ({ budgetFile, send, calls, origin }) => {
    await beginBudgetTurn(budgetFile)
    for (const invalid of [
      { ...request, model: 'unknown' },
      { ...request, max_output_tokens: undefined },
      { ...request, max_output_tokens: 101 },
      { ...request, tools: [{ type: 'web_search' }] },
      { ...request, input: [{ type: 'input_image', image_url: 'synthetic' }] },
      { ...request, service_tier: 'priority' },
      { ...request, previous_response_id: 'unbounded-history' },
      { ...request, max_tokens: 100 },
      { ...request, cache: {} },
      { ...request, cache: { 'no-cache': true } },
      { ...request, cache: { 'no-cache': true, 'no-store': false } },
      {
        ...request,
        cache: { 'no-cache': true, 'no-store': true, 'max-age': 0 },
      },
      { ...request, cache: false },
      { ...request, cache: 'no-store' },
      { ...request, prompt_cache_key: '' },
      { ...request, prompt_cache_key: '   ' },
      { ...request, prompt_cache_key: 'x'.repeat(65) },
      { ...request, prompt_cache_key: 7 },
    ]) {
      const response = await send(invalid)
      assert.equal(response.status, 502)
      await response.text()
    }
    const response = await fetch(origin + '/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-guard-key' },
      body: JSON.stringify({
        model: 'synthetic-model',
        messages: [],
        max_completion_tokens: 100,
        n: 2,
      }),
    })
    assert.equal(response.status, 502)
    assert.equal(calls.length, 0)
    assert.equal(
      (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
      0
    )
  })
})

test('the two true cache-bypass flags are stripped before forwarding and the native prompt cache key is retained', async () => {
  validatePricingPolicy(policy)
  const hinted = {
    ...request,
    cache: { 'no-cache': true, 'no-store': true },
    prompt_cache_key: 'synthetic-prompt-cache-key',
  }
  assert.equal(requestReservation(policy, '/v1/responses', hinted), 1200)
  await scenario(async ({ budgetFile, send, calls }) => {
    await beginBudgetTurn(budgetFile)
    const response = await send(hinted)
    assert.equal(response.status, 200)
    await response.text()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.cache, undefined)
    assert.equal(calls[0].body.prompt_cache_key, 'synthetic-prompt-cache-key')
    assert.equal(
      (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
      1200
    )
  })
})

test('guard denies calls without active turn and qualification binds experiment policy and route', async () => {
  await scenario(
    async ({ directory, budgetFile, origin, send, calls, qualifiedPolicy }) => {
      assert.equal((await send()).status, 502)
      assert.equal(calls.length, 0)
      const ledger = await readBudgetLedger(budgetFile)
      const filePath = join(directory, 'qualification.json')
      const qualification = {
        version: 1,
        experimentId: ledger.experimentId,
        policyHash: ledger.policyHash,
        guardOrigin: origin,
        chatOrigin: 'http://chat.localhost',
        chatbotId: 'synthetic-bot',
        modelId: 'synthetic-model',
        allBillableEgressGuarded: true,
        evidence: 'fake application forwarding proof',
        upstreamOrigin: qualifiedPolicy.upstreamOrigin,
      }
      await writeFile(filePath, JSON.stringify(qualification))
      const config = {
        filePath,
        origin,
        key: 'synthetic-guard-key',
        budgetFile,
        chatOrigin: qualification.chatOrigin,
        chatbotId: qualification.chatbotId,
        modelId: qualification.modelId,
      }
      assert.equal(
        (await verifyGuardQualification(config)).experimentId,
        ledger.experimentId
      )
      await assert.rejects(
        verifyGuardQualification({ ...config, modelId: 'wrong' }),
        { code: 'guard_qualification_invalid' }
      )
      await assert.rejects(
        verifyGuardQualification({ ...config, key: 'wrong' }),
        { code: 'guard_unavailable' }
      )
      await writeFile(
        filePath,
        JSON.stringify({
          ...qualification,
          upstreamOrigin: 'https://different.example/v1',
        })
      )
      await assert.rejects(verifyGuardQualification(config), {
        code: 'guard_qualification_invalid',
      })
      await assert.rejects(
        createSpendGuard({
          policy: qualifiedPolicy,
          budgetFile,
          apiKey: 'synthetic',
          upstreamKey: 'synthetic',
          upstreamOrigin: 'https://different.example/v1',
        }),
        { code: 'provider_guard_configuration_invalid' }
      )
    }
  )
})

test('interrupted turns, changed identities, missing state and locks fail closed without resetting spend', async () => {
  await scenario(async ({ budgetFile, qualifiedPolicy }) => {
    const token = await beginBudgetTurn(budgetFile)
    await reserveProviderSpend(budgetFile, fingerprint(qualifiedPolicy), 1200)
    await assert.rejects(beginBudgetTurn(budgetFile), {
      code: 'budget_uncertain',
    })
    const release = await acquireBudgetLock(budgetFile)
    await assert.rejects(finishBudgetTurn(budgetFile, token, 1), {
      code: 'budget_busy',
    })
    await release()
    await assert.rejects(
      reserveProviderSpend(budgetFile, '0'.repeat(64), 1200),
      { code: 'budget_policy_mismatch' }
    )
    const ledger = await readBudgetLedger(budgetFile)
    await writeFile(
      budgetFile,
      JSON.stringify({ ...ledger, maxProviderMicroUsd: 3000 })
    )
    await assert.rejects(readBudgetLedger(budgetFile), {
      code: 'budget_identity_mismatch',
    })
    await unlink(budgetFile)
    await assert.rejects(readBudgetLedger(budgetFile), {
      code: 'budget_missing',
    })
    await assert.rejects(initializeBudget(budgetFile, fingerprint(policy)), {
      code: 'budget_exists',
    })
  })
})

test('abandoned run leases and uncertain guard restarts cannot forward another request', async () => {
  await scenario(
    async ({ budgetFile, qualifiedPolicy, release, send, calls }) => {
      await beginBudgetTurn(budgetFile)
      const admitted = await send()
      await admitted.text()
      assert.equal(admitted.status, 200)
      await release()
      await writeFile(budgetFile + '.run', 'stale-token')
      const denied = await send()
      assert.equal((await denied.json()).error, 'budget_run_inactive')
      assert.equal(calls.length, 1)
      assert.equal(
        (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
        1200
      )
      await assert.rejects(
        createSpendGuard({
          policy: qualifiedPolicy,
          budgetFile,
          apiKey: 'synthetic',
          upstreamKey: 'synthetic',
          upstreamOrigin: qualifiedPolicy.upstreamOrigin,
        }),
        { code: 'budget_uncertain' }
      )
    }
  )
})
