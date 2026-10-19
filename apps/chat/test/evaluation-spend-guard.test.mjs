import { strict as assert } from 'node:assert'
import { unlinkSync } from 'node:fs'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import {
  acquireBudgetLock,
  beginBudgetTurn,
  createBudgetLedger,
  fingerprint,
  finishBudgetTurn,
  initializeBudget,
  mutateBudget,
  readBudgetLedger,
  reserveProviderSpend,
  validateBudgetLedger,
} from '../../../evaluation/evaluation-budget.mjs'
import {
  createSpendGuard,
  main,
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
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  return 'http://127.0.0.1:' + server.address().port
}
async function close(server) {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}

async function scenario(body, options = {}) {
  const settings = typeof options === 'number' ? { cap: options } : options
  const {
    cap = 2400,
    basePolicy = policy,
    path = '/v1/responses',
    maxSubmittedTurns,
  } = settings
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  const budgetFile = join(directory, 'budget.json')
  const calls = []
  // A fixture assertion or body-parse failure must not be swallowed by the
  // async HTTP handler; respond so the client unblocks, then surface it.
  const upstreamFailures = []
  let upstream
  let guard
  let release = null
  let bodyError = null
  try {
    upstream = createServer(async (req, res) => {
      try {
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
      } catch (error) {
        upstreamFailures.push(error)
        if (!res.headersSent) res.writeHead(500)
        res.end('synthetic upstream fixture failure')
      }
    })
    const upstreamOrigin = await listen(upstream)
    const qualifiedPolicy = {
      ...basePolicy,
      upstreamOrigin: upstreamOrigin + '/v1',
    }
    await initializeBudget(budgetFile, fingerprint(qualifiedPolicy), {
      maxProviderMicroUsd: cap,
      maxSubmittedTurns,
    })
    guard = await createSpendGuard({
      policy: qualifiedPolicy,
      budgetFile,
      apiKey: 'synthetic-guard-key',
      upstreamKey: 'synthetic-upstream-key',
      upstreamOrigin: upstreamOrigin + '/v1',
    })
    const origin = await listen(guard)
    release = await acquireBudgetLock(budgetFile, '.run')
    const send = (payload = request, headers = {}) =>
      fetch(origin + path, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer synthetic-guard-key',
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      })
    await body({
      directory,
      budgetFile,
      calls,
      origin,
      send,
      qualifiedPolicy,
      release,
    })
  } catch (error) {
    bodyError = error
  } finally {
    try {
      if (release) await release()
    } finally {
      try {
        if (guard) await close(guard)
      } finally {
        try {
          if (upstream) await close(upstream)
        } finally {
          await rm(directory, { recursive: true, force: true })
        }
      }
    }
  }
  const failures = [...upstreamFailures]
  if (bodyError) failures.push(bodyError)
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, 'evaluation guard scenario failed')
}

test('guard reserves each step and retry durably before forwarding and never refunds failures', async () => {
  await scenario(
    async ({ budgetFile, send, calls }) => {
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
    },
    { basePolicy: openRouterPolicy() }
  )
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
      { ...request, store: true },
      {
        ...request,
        input: [
          {
            type: 'message',
            content: [
              {
                type: 'input_text',
                text: 'synthetic input',
                cache_control: { type: 'ephemeral' },
              },
            ],
          },
        ],
      },
    ]) {
      const response = await send(invalid)
      assert.equal(response.status, 502)
      await response.text()
    }
    for (const body of [
      {
        model: 'synthetic-model',
        messages: [],
        max_completion_tokens: 100,
        n: 2,
      },
      {
        model: 'synthetic-model',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'synthetic input',
                cache_control: { type: 'ephemeral' },
              },
            ],
          },
        ],
        max_completion_tokens: 100,
      },
    ]) {
      const response = await fetch(origin + '/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-guard-key' },
        body: JSON.stringify(body),
      })
      assert.equal(response.status, 502)
      await response.text()
    }
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
        verifyGuardQualification({
          ...config,
          filePath: join(directory, 'missing-qualification.json'),
        }),
        (error) =>
          error.code === 'guard_qualification_unavailable' &&
          error.cause?.code === 'ENOENT'
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
      await assert.rejects(
        createSpendGuard({
          policy: qualifiedPolicy,
          budgetFile,
          apiKey: 'synthetic',
          upstreamKey: 'synthetic',
          upstreamOrigin: 'not a URL',
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
      const releaseNextRun = await acquireBudgetLock(budgetFile, '.run')
      try {
        const next = await send()
        assert.equal(next.status, 200)
        await next.text()
      } finally {
        await releaseNextRun()
      }
      await writeFile(budgetFile + '.run', 'stale-token')
      const denied = await send()
      assert.equal((await denied.json()).error, 'budget_run_inactive')
      assert.equal(calls.length, 2)
      assert.equal(
        (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
        2400
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

test('a lock-release failure preserves the mutation error and leaves the ledger unchanged', async () => {
  await scenario(async ({ budgetFile }) => {
    const before = await readBudgetLedger(budgetFile)
    await assert.rejects(
      mutateBudget(budgetFile, (ledger) => {
        ledger.creditsUsed = -1
        unlinkSync(budgetFile + '.lock')
      }),
      (error) =>
        error.code === 'budget_invalid' &&
        error.cause instanceof AggregateError &&
        error.cause.errors[0].code === 'ENOENT'
    )
    assert.deepEqual(await readBudgetLedger(budgetFile), before)
    await assert.rejects(
      mutateBudget(budgetFile, () => {
        unlinkSync(budgetFile + '.lock')
      }),
      (error) =>
        error.code === 'budget_lock_failed' && error.cause?.code === 'ENOENT'
    )
    assert.deepEqual(await readBudgetLedger(budgetFile), before)
  })
})

test('deeply nested request input is refused before reservation or upstream dispatch', async () => {
  let nested = 'synthetic input'
  for (let depth = 0; depth < 80; depth += 1) nested = [nested]
  const deep = { ...request, input: nested }
  assert.throws(() => requestReservation(policy, '/v1/responses', deep), {
    code: 'provider_request_invalid',
  })
  await scenario(async ({ budgetFile, send, calls }) => {
    await beginBudgetTurn(budgetFile)
    const response = await send(deep)
    assert.equal(response.status, 502)
    assert.equal((await response.json()).error, 'provider_request_invalid')
    assert.equal(calls.length, 0)
    assert.equal(
      (await readBudgetLedger(budgetFile)).reservedProviderMicroUsd,
      0
    )
  })
})

test('guard startup rejects a bind failure with EADDRINUSE and registers no shutdown signals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  const budgetFile = join(directory, 'budget.json')
  const policyFile = join(directory, 'pricing.json')
  const occupied = createServer(() => {})
  try {
    const port = await new Promise((resolve) => {
      occupied.listen(0, '127.0.0.1', () => resolve(occupied.address().port))
    })
    await writeFile(policyFile, JSON.stringify(policy))
    await initializeBudget(budgetFile, fingerprint(policy))
    const signals = ['SIGTERM', 'SIGINT']
    const before = signals.map((signal) => process.listenerCount(signal))
    await assert.rejects(
      main(
        {
          KLICKER_EVAL_PRICING_FILE: policyFile,
          KLICKER_EVAL_BUDGET_FILE: budgetFile,
          KLICKER_EVAL_GUARD_KEY: 'synthetic-guard-key',
          KLICKER_EVAL_UPSTREAM_ORIGIN: policy.upstreamOrigin,
          KLICKER_EVAL_UPSTREAM_KEY: 'synthetic-upstream-key',
          KLICKER_EVAL_GUARD_PORT: String(port),
          KLICKER_EVAL_GUARD_HOST: '127.0.0.1',
        },
        []
      ),
      { code: 'EADDRINUSE' }
    )
    assert.deepEqual(
      signals.map((signal) => process.listenerCount(signal)),
      before
    )
  } finally {
    await close(occupied)
    await rm(directory, { recursive: true, force: true })
  }
})

test('central ledger limits accept legacy budgets and the exact US$55/48 pair and reject everything else directly', async () => {
  const policyHash = 'f'.repeat(64)
  for (const [maxProviderMicroUsd, maxSubmittedTurns] of [
    [1, 1],
    [4_999_999, 119],
    [5_000_000, 120],
    [55_000_000, 48],
  ]) {
    const ledger = createBudgetLedger(policyHash, {
      maxProviderMicroUsd,
      maxSubmittedTurns,
    })
    assert.equal(ledger.maxProviderMicroUsd, maxProviderMicroUsd)
    assert.equal(ledger.maxSubmittedTurns, maxSubmittedTurns)
  }
  for (const [maxProviderMicroUsd, maxSubmittedTurns] of [
    [5_000_001, 120],
    [5_000_001, 48],
    [54_000_000, 48],
    [54_999_999, 48],
    [55_000_001, 48],
    [55_000_000, 1],
    [55_000_000, 47],
    [55_000_000, 49],
    [55_000_000, 120],
    [1, 121],
    [0, 1],
    [1, 0],
    [-5_000_000, 48],
    [5_500_000.5, 48],
    [55_000_000, 48.5],
    [Number.MAX_SAFE_INTEGER + 1, 48],
    ['55000000', 48],
  ]) {
    assert.throws(
      () =>
        createBudgetLedger(policyHash, {
          maxProviderMicroUsd,
          maxSubmittedTurns,
        }),
      { code: 'budget_invalid' }
    )
  }
  const exact = createBudgetLedger(policyHash, {
    maxProviderMicroUsd: 55_000_000,
    maxSubmittedTurns: 48,
  })
  assert.equal(validateBudgetLedger(exact), exact)
  for (const invalid of [
    { ...exact, maxProviderMicroUsd: 55_000_000.5 },
    { ...exact, maxSubmittedTurns: '48' },
    { ...exact, maxProviderMicroUsd: null },
  ]) {
    assert.throws(() => validateBudgetLedger(invalid), {
      code: 'budget_invalid',
    })
  }
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  try {
    const budgetFile = join(directory, 'budget.json')
    await writeFile(budgetFile, JSON.stringify(exact) + '\n')
    await writeFile(
      budgetFile + '.identity',
      JSON.stringify([
        2,
        exact.experimentId,
        policyHash,
        exact.maxSubmittedTurns,
        exact.maxProviderMicroUsd,
      ])
    )
    assert.deepEqual(await readBudgetLedger(budgetFile), exact)
    const intermediate = { ...exact, maxProviderMicroUsd: 54_000_000 }
    await writeFile(budgetFile, JSON.stringify(intermediate) + '\n')
    await writeFile(
      budgetFile + '.identity',
      JSON.stringify([
        2,
        intermediate.experimentId,
        policyHash,
        intermediate.maxSubmittedTurns,
        intermediate.maxProviderMicroUsd,
      ])
    )
    await assert.rejects(readBudgetLedger(budgetFile), {
      code: 'budget_invalid',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('the initializer CLI accepts the exact US$55/48 pair in either order and defaults to US$5/120', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  try {
    const policyFile = join(directory, 'pricing.json')
    await writeFile(policyFile, JSON.stringify(policy))
    const initialize = async (name, argv) => {
      const budgetFile = join(directory, name)
      await main(
        {
          KLICKER_EVAL_PRICING_FILE: policyFile,
          KLICKER_EVAL_BUDGET_FILE: budgetFile,
        },
        argv
      )
      return { budgetFile, ledger: await readBudgetLedger(budgetFile) }
    }
    const orders = [
      [
        '--initialize-budget',
        '--max-provider-micro-usd',
        '55000000',
        '--max-submitted-turns',
        '48',
      ],
      [
        '--initialize-budget',
        '--max-submitted-turns',
        '48',
        '--max-provider-micro-usd',
        '55000000',
      ],
    ]
    for (const [index, argv] of orders.entries()) {
      const { budgetFile, ledger } = await initialize(
        'exact-' + index + '.json',
        argv
      )
      assert.equal(ledger.maxProviderMicroUsd, 55_000_000)
      assert.equal(ledger.maxSubmittedTurns, 48)
      assert.deepEqual(
        JSON.parse(await readFile(budgetFile + '.identity', 'utf8')),
        [2, ledger.experimentId, ledger.policyHash, 48, 55_000_000]
      )
    }
    const { ledger } = await initialize('default.json', ['--initialize-budget'])
    assert.equal(ledger.maxProviderMicroUsd, 5_000_000)
    assert.equal(ledger.maxSubmittedTurns, 120)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('invalid initializer arguments are rejected before any budget file is created', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
  try {
    const policyFile = join(directory, 'pricing.json')
    await writeFile(policyFile, JSON.stringify(policy))
    const budgetFile = join(directory, 'budget.json')
    const env = {
      KLICKER_EVAL_PRICING_FILE: policyFile,
      KLICKER_EVAL_BUDGET_FILE: budgetFile,
    }
    const exact = (spend, turns) => [
      '--initialize-budget',
      '--max-provider-micro-usd',
      spend,
      '--max-submitted-turns',
      turns,
    ]
    for (const argv of [
      ['--initialize-budget', '--max-provider-micro-usd', '55000000'],
      ['--initialize-budget', '--max-submitted-turns', '48'],
      ['--initialize-budget', '--max-provider-micro-usd'],
      ['--initialize-budget', '--max-submitted-turns'],
      [
        '--initialize-budget',
        '--max-provider-micro-usd',
        '55000000',
        '--max-provider-micro-usd',
        '55000000',
        '--max-submitted-turns',
        '48',
      ],
      [
        '--initialize-budget',
        '--max-submitted-turns',
        '48',
        '--max-submitted-turns',
        '48',
        '--max-provider-micro-usd',
        '55000000',
      ],
      [...exact('55000000', '48'), '--unknown'],
      [...exact('55000000', '48'), 'extra'],
      ['--max-provider-micro-usd', '55000000', '--max-submitted-turns', '48'],
      exact('5.5e7', '48'),
      exact('55000000.0', '48'),
      exact('55000000.5', '48'),
      exact('055000000', '48'),
      exact('-1', '48'),
      exact('55000001', '48'),
      exact('54000000', '48'),
      exact('55000000', '48.0'),
      exact('55000000', '0'),
      exact('55000000', '47'),
      exact('55000000', '49'),
    ]) {
      await assert.rejects(main(env, argv), {
        code: 'provider_guard_arguments_invalid',
      })
    }
    await assert.rejects(readFile(budgetFile), { code: 'ENOENT' })
    await assert.rejects(readFile(budgetFile + '.identity'), { code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

const extendedBudgetArguments = [
  '--initialize-budget',
  '--max-provider-micro-usd',
  '55000000',
  '--max-submitted-turns',
  '48',
]
for (const [
  name,
  initialArguments,
  replacementArguments,
  replacementLimits,
] of [
  [
    'legacy limits cannot be raised',
    ['--initialize-budget'],
    extendedBudgetArguments,
    { maxProviderMicroUsd: 55_000_000, maxSubmittedTurns: 48 },
  ],
  [
    'extended limits cannot be lowered',
    extendedBudgetArguments,
    ['--initialize-budget'],
    { maxProviderMicroUsd: 5_000_000, maxSubmittedTurns: 120 },
  ],
]) {
  test(name + ' through reinitialization or identity mutation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'evaluation-guard-'))
    try {
      const policyFile = join(directory, 'pricing.json')
      await writeFile(policyFile, JSON.stringify(policy))
      const budgetFile = join(directory, 'budget.json')
      const env = {
        KLICKER_EVAL_PRICING_FILE: policyFile,
        KLICKER_EVAL_BUDGET_FILE: budgetFile,
      }
      await main(env, initialArguments)
      const before = await readBudgetLedger(budgetFile)
      const ledgerBytes = await readFile(budgetFile, 'utf8')
      const receiptBytes = await readFile(budgetFile + '.identity', 'utf8')
      await assert.rejects(main(env, replacementArguments), {
        code: 'budget_exists',
      })
      await assert.rejects(
        initializeBudget(budgetFile, before.policyHash, replacementLimits),
        { code: 'budget_exists' }
      )
      await assert.rejects(
        mutateBudget(budgetFile, (ledger) => {
          Object.assign(ledger, replacementLimits)
        }),
        { code: 'budget_identity_mismatch' }
      )
      assert.equal(await readFile(budgetFile, 'utf8'), ledgerBytes)
      assert.equal(
        await readFile(budgetFile + '.identity', 'utf8'),
        receiptBytes
      )
      assert.deepEqual(await readBudgetLedger(budgetFile), before)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
}

test('guard admits the final submitted turn and last reservation, then refuses the next turn and reservation', async () => {
  await scenario(
    async ({ budgetFile, send, calls }) => {
      await mutateBudget(budgetFile, (ledger) => {
        ledger.submittedTurns = 47
        ledger.reservedProviderMicroUsd = 55_000_000 - 1200
      })
      const token = await beginBudgetTurn(budgetFile)
      const admitted = await send()
      assert.equal(admitted.status, 200)
      await admitted.text()
      assert.equal(calls.length, 1)
      const denied = await send()
      assert.equal(denied.status, 429)
      assert.equal((await denied.json()).error, 'budget_spend_exhausted')
      assert.equal(calls.length, 1)
      const finished = await finishBudgetTurn(budgetFile, token, 0)
      assert.equal(finished.submittedTurns, 48)
      assert.equal(finished.reservedProviderMicroUsd, 55_000_000)
      await assert.rejects(beginBudgetTurn(budgetFile), {
        code: 'budget_turns_exhausted',
      })
      assert.deepEqual(await readBudgetLedger(budgetFile), finished)
    },
    { cap: 55_000_000, maxSubmittedTurns: 48 }
  )
})

const chatRequest = {
  model: 'synthetic-model',
  messages: [{ role: 'user', content: 'synthetic input' }],
  max_completion_tokens: 100,
  stream: true,
}

// A fresh policy per scenario so the mutation test cannot corrupt the shared fixture.
function openRouterPolicy(upstreamOrigin = 'https://openrouter.ai/api/v1') {
  return {
    ...policy,
    upstreamOrigin,
    models: { 'synthetic-model': { ...policy.models['synthetic-model'] } },
    fixedRoute: { type: 'openrouter', provider: 'openai' },
  }
}

const injectedProvider = {
  only: ['openai'],
  order: ['openai'],
  allow_fallbacks: false,
  require_parameters: true,
  max_price: { prompt: '1', completion: '2', request: '0' },
}

test('an OpenRouter origin requires the exact closed fixed route and unrelated direct providers keep their shape', () => {
  for (const upstreamOrigin of [
    'https://openrouter.ai/api/v1',
    'https://openrouter.ai./api/v1',
    'https://api.openrouter.ai/api/v1',
  ]) {
    assert.throws(() => validatePricingPolicy({ ...policy, upstreamOrigin }), {
      code: 'pricing_policy_invalid',
    })
    assert.equal(
      validatePricingPolicy(openRouterPolicy(upstreamOrigin)).fixedRoute
        .provider,
      'openai'
    )
  }
  for (const upstreamOrigin of [
    'http://localhost:4321/v1',
    'http://127.0.0.1:4321/v1',
    'http://[::1]:4321/v1',
    'https://localhost:4321/v1',
    'https://127.0.0.1:4321/v1',
    'https://[::1]:4321/v1',
  ]) {
    assert.equal(
      validatePricingPolicy({ ...policy, upstreamOrigin }).upstreamOrigin,
      upstreamOrigin
    )
    assert.equal(
      validatePricingPolicy(openRouterPolicy(upstreamOrigin)).fixedRoute
        .provider,
      'openai'
    )
  }
  for (const upstreamOrigin of [
    'https://api.openai.com/v1',
    'https://openrouter.ai.evil.com/v1',
    'https://evilopenrouter.ai/v1',
    'https://localhost.evil.com/v1',
    'https://foo.localhost/v1',
    'https://localhost.:4321/v1',
    'https://0.0.0.0:4321/v1',
    'https://127.0.0.2:4321/v1',
    'https://192.0.2.1/v1',
  ]) {
    assert.equal(
      validatePricingPolicy({ ...policy, upstreamOrigin }).upstreamOrigin,
      upstreamOrigin
    )
    assert.throws(
      () => validatePricingPolicy(openRouterPolicy(upstreamOrigin)),
      { code: 'pricing_policy_invalid' }
    )
  }
  for (const fixedRoute of [
    null,
    {},
    { type: 'openrouter' },
    { type: 'openrouter', provider: 'anthropic' },
    { type: 'generic', provider: 'openai' },
    { type: 'openrouter', provider: 'openai', only: ['openai'] },
  ]) {
    assert.throws(
      () => validatePricingPolicy({ ...openRouterPolicy(), fixedRoute }),
      { code: 'pricing_policy_invalid' }
    )
  }
})

test('guard injects the closed OpenRouter route, refuses client routing controls and snapshots the policy on both API paths', async () => {
  for (const [path, payload] of [
    ['/v1/responses', request],
    ['/v1/chat/completions', chatRequest],
  ]) {
    await scenario(
      async ({ budgetFile, qualifiedPolicy, origin, send, calls }) => {
        const originalUpstream = qualifiedPolicy.upstreamOrigin
        const originalHash = fingerprint(qualifiedPolicy)
        await beginBudgetTurn(budgetFile)
        const first = await send(payload)
        assert.equal(first.status, 200)
        await first.text()
        assert.equal(calls.length, 1)
        assert.equal(calls[0].body.service_tier, 'default')
        assert.deepEqual(calls[0].body.provider, injectedProvider)
        for (const control of [
          { provider: { allow_fallbacks: true } },
          { models: ['synthetic-model'] },
        ]) {
          const denied = await send({ ...payload, ...control })
          assert.equal(denied.status, 502)
          assert.equal(
            (await denied.json()).error,
            'provider_request_field_unqualified'
          )
        }
        assert.equal(calls.length, 1)
        qualifiedPolicy.models['synthetic-model'].outputMicroUsdPerMillion =
          999_000_000
        qualifiedPolicy.fixedRoute.provider = 'anthropic'
        qualifiedPolicy.upstreamOrigin = 'https://mutated.example/v1'
        const second = await send({
          ...payload,
          tools: [
            {
              type: 'function',
              name: 'lookup',
              parameters: { type: 'object' },
            },
          ],
        })
        assert.equal(second.status, 200)
        await second.text()
        assert.equal(calls.length, 2)
        assert.equal(calls[1].body.tools[0].type, 'function')
        assert.deepEqual(calls[1].body.provider, injectedProvider)
        const status = await fetch(`${origin}/status`, {
          headers: { Authorization: 'Bearer synthetic-guard-key' },
          redirect: 'error',
        })
        assert.equal((await status.json()).upstreamOrigin, originalUpstream)
        const ledger = await readBudgetLedger(budgetFile)
        assert.equal(ledger.reservedProviderMicroUsd, 2400)
        assert.equal(ledger.policyHash, originalHash)
      },
      { basePolicy: openRouterPolicy(), path }
    )
  }
})
