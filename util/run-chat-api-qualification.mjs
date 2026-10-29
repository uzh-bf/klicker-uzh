import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import {
  QUALIFICATION_ENGINE_ID,
  SYNTHETIC_PROVIDER_TOKEN,
  SYNTHETIC_SERVICE_TOKEN,
  startQualificationFixtures,
} from './chat-api-qualification-fixtures.mjs'

const root = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
)
const directory = resolve(process.argv[3] ?? '')
const mode = process.argv[2]
const reviews = join(root, 'project', '_local', 'reviews')
assert(process.argv[3] && directory.startsWith(`${reviews}${sep}`))
assert.equal(realpathSync(dirname(directory)), dirname(directory))
if (mode !== '--host') assert.equal(realpathSync(directory), directory)

const receiptPath = (name) => {
  assert(/^[a-z][a-z0-9-]*\.json$/.test(name))
  const path = resolve(directory, name)
  assert(path.startsWith(`${reviews}${sep}`))
  assert.equal(realpathSync(dirname(path)), dirname(path))
  return path
}
const shutdown = new AbortController()
if (mode === '--worker') {
  process.once('SIGTERM', () => shutdown.abort())
  process.once('SIGINT', () => shutdown.abort())
  setTimeout(() => shutdown.abort(), 780000).unref()
}
const receipt = (name, data) => {
  const path = receiptPath(name)
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  })
  renameSync(temporary, path)
}
const readReceipt = (name) => {
  const descriptor = openSync(
    receiptPath(name),
    constants.O_RDONLY | constants.O_NOFOLLOW
  )
  try {
    return JSON.parse(readFileSync(descriptor, 'utf8'))
  } finally {
    closeSync(descriptor)
  }
}

async function waitFor(test, milliseconds) {
  const deadline = Date.now() + milliseconds
  let pause = 100
  while (Date.now() < deadline) {
    shutdown.signal.throwIfAborted()
    if (await test()) return
    await delay(pause)
    pause = Math.min(pause * 2, 2000)
  }
  throw new Error('Qualification readiness deadline exceeded')
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await Promise.race([
    exited,
    delay(10000, undefined, { ref: false }).then(() => {
      throw new Error('Owned process did not stop')
    }),
  ])
}

async function worker() {
  assert.equal(process.env.CHAT_API_QUALIFICATION, '1')
  const setup = readReceipt('setup.json')
  assert.equal(setup.containerSourcePath, root)
  receipt('worker-owner.json', {
    generation: setup.generation,
    sourcePath: setup.sourcePath,
    containerSourcePath: root,
    pid: process.pid,
  })
  const { prisma, requireDisposableDatabase } = await import(
    '../packages/prisma/dist/index.js'
  )
  await requireDisposableDatabase(prisma)
  const id = {
    owner: randomUUID(),
    participant: randomUUID(),
    course: randomUUID(),
    bot: randomUUID(),
    thread: randomUUID(),
  }
  const tag = `chat-qualification-${randomUUID()}`
  const username = `chatq-${setup.generation.slice(0, 8)}`
  let fixtures
  let api
  let owned = false
  let phase = 'synthetic-seed'
  let lastHttpStatus = null
  let lastHttpCode = null
  const checks = []
  async function startApi(enabled, pilots = [id.bot]) {
    api = spawn(process.execPath, [join(root, 'apps/chat-api/dist/index.js')], {
      cwd: root,
      env: {
        ...process.env,
        ...fixtures.apiEnvironment,
        CHAT_CODEAPI_ENABLED: enabled ? 'true' : 'false',
        CHAT_CODEAPI_PILOT_CHATBOT_IDS: JSON.stringify(pilots),
        CHAT_ENGINE_URL: setup.engineUrl,
        CHAT_ENGINE_ID: QUALIFICATION_ENGINE_ID,
        CHAT_ENGINE_SERVICE_TOKEN: SYNTHETIC_SERVICE_TOKEN,
        CHAT_BROWSER_ALLOWED_ORIGINS: setup.chatOrigin,
        CHAT_TURN_LIFECYCLE_WRITES_ENABLED: 'true',
        CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED: 'true',
        PORT: '3005',
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    api.on('error', () => {})
    await waitFor(async () => {
      if (api.exitCode !== null)
        throw new Error('API child exited before readiness')
      try {
        return (
          await fetch('http://127.0.0.1:3005/ready', {
            signal: AbortSignal.timeout(6000),
          })
        ).ok
      } catch {
        return false
      }
    }, 60000)
  }
  try {
    await prisma.user.create({
      data: {
        id: id.owner,
        email: `${tag}@example.invalid`,
        shortname: tag,
        aiFeaturesEnabled: true,
      },
    })
    owned = true
    await prisma.course.create({
      data: {
        id: id.course,
        ownerId: id.owner,
        name: tag,
        displayName: 'Synthetic qualification course',
        authType: 'SSO',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        groupDeadlineDate: new Date(Date.now() + 86400000),
      },
    })
    await prisma.chatbot.create({
      data: {
        id: id.bot,
        ownerId: id.owner,
        courseId: id.course,
        name: tag,
        status: 'PUBLISHED',
        modelSelection: true,
        allowedModelIds: ['gpt-6-luna'],
        creditInitialCredits: 10,
        creditMaxCredits: 10,
        creditResetPeriod: 'NONE',
      },
    })
    const { default: bcrypt } = await import(
      '../packages/graphql/node_modules/bcryptjs/index.js'
    )
    await prisma.participant.create({
      data: {
        id: id.participant,
        username,
        password: await bcrypt.hash('synthetic-local-browser-password', 10),
      },
    })
    await prisma.participation.create({
      data: {
        courseId: id.course,
        participantId: id.participant,
        isActive: true,
      },
    })
    await prisma.chatThread.create({
      data: { id: id.thread, participantId: id.participant, chatbotId: id.bot },
    })
    const { getZurichMonthStart } = await import(
      '../packages/util/dist/index.js'
    )
    const usageKey = {
      ownerId: id.owner,
      usageClass: 'BASE',
      monthStart: getZurichMonthStart(new Date()),
    }
    await prisma.chatAccountUsage.create({
      data: { ...usageKey, budgetCredits: 10, usedCredits: 0 },
    })
    phase = 'fixtures-start'
    fixtures = await startQualificationFixtures({
      hostname: setup.fixtureHost,
      chatbotId: id.bot,
      participantId: id.participant,
    })
    const publicEnvironment = { ...fixtures.engineEnvironment }
    delete publicEnvironment.CATALYST_ENGINE_PROVIDER_API_KEY
    delete publicEnvironment.CATALYST_ENGINE_SERVICE_TOKEN
    writeFileSync(join(directory, 'fixture-ca.pem'), fixtures.certificate)
    receipt('fixtures.json', {
      generation: setup.generation,
      publicEnvironment,
    })
    phase = 'api-engine-readiness'
    await startApi(true)
    const secret = process.env.APP_SECRET
    assert(secret)
    const { signJWT } = await import('../packages/util/dist/index.js')
    assert(process.env.APP_ORIGIN_API)
    const jwt = await signJWT(
      { sub: id.participant, role: 'PARTICIPANT' },
      secret,
      {
        issuer: process.env.APP_ORIGIN_API,
        expiresIn: '5m',
      }
    )
    const apiOrigin = 'http://127.0.0.1:3005'
    const headers = {
      cookie: `participant_token=${jwt}`,
      origin: apiOrigin,
      'content-type': 'application/json',
    }
    const body = {
      threadId: id.thread,
      selectedModel: 'gpt-6-luna',
      selectedMode: 'tutor',
      assistantMessageId: randomUUID(),
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          content: 'Calculate using the Python tool.',
        },
      ],
    }
    let httpCalls = 0
    const call = async (suffix, data, method = 'POST') => {
      assert(++httpCalls <= 24)
      const response = await fetch(
        `${apiOrigin}/api/chatbots/${id.bot}${suffix}`,
        {
          method,
          headers,
          ...(data === undefined ? {} : { body: JSON.stringify(data) }),
          signal: AbortSignal.any([
            shutdown.signal,
            AbortSignal.timeout(45000),
          ]),
          redirect: 'error',
        }
      )
      lastHttpStatus = response.status
      const text = await response.text()
      if (!response.ok) {
        try {
          const code = JSON.parse(text).code
          lastHttpCode =
            typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code)
              ? code
              : null
        } catch {}
      }
      assert(Buffer.byteLength(text) < 128 * 1024)
      return { response, text }
    }
    phase = 'initial-http-turn'
    const first = await call('/chat', body)
    assert.equal(first.response.status, 200)
    const frames = first.text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
      .map((line) => JSON.parse(line.slice(6)))
    assert(!frames.some((frame) => frame.type === 'error'))
    const terminals = frames.filter((frame) => frame.type === 'finish')
    assert.equal(terminals.length, 1)
    assert.equal(
      terminals[0].messageMetadata.finalPersistenceStatus,
      'persisted'
    )
    phase = 'canonical-persistence-and-usage'
    const stored = await prisma.chatMessage.findUniqueOrThrow({
      where: { id: body.assistantMessageId },
    })
    assert.equal(stored.lifecycleStatus, 'COMPLETED')
    assert(
      stored.content.some(
        (part) => part.type === 'text' && part.text.includes(fixtures.answer)
      )
    )
    const charged = stored.creditsUsed.toNumber()
    assert(charged > 0)
    assert.equal(terminals[0].messageMetadata.creditsUsed, charged)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: { ownerId_usageClass_monthStart: usageKey },
    })
    assert.equal(usage.usedCredits.toNumber(), charged)
    assert.deepEqual(fixtures.stats(), {
      modelCalls: 2,
      codeApiCalls: 1,
      resultConsumed: true,
      violations: 0,
    })
    checks.push('real-http-prisma-catalyst-result-and-single-charge')
    const beforeReplay = fixtures.stats()
    const replay = await call('/chat', body)
    assert.equal(replay.response.status, 409)
    assert.deepEqual(fixtures.stats(), beforeReplay)
    assert.equal(
      (
        await prisma.chatAccountUsage.findUniqueOrThrow({
          where: { ownerId_usageClass_monthStart: usageKey },
        })
      ).usedCredits.toNumber(),
      charged
    )
    checks.push('replay-no-model-tool-or-debit')
    const history = await call(
      `/threads/${id.thread}/messages`,
      undefined,
      'GET'
    )
    assert.equal(history.response.status, 200)
    const messages = JSON.parse(history.text)
    assert(messages.some((message) => message.id === body.assistantMessageId))
    assert(
      messages.every((message) => !Object.hasOwn(message, 'lifecycleAttemptId'))
    )
    for (const rating of ['UP', null])
      assert.equal(
        (
          await call(
            `/threads/${id.thread}/messages/${body.assistantMessageId}/feedback`,
            { rating }
          )
        ).response.status,
        200
      )
    checks.push('history-and-feedback')
    await prisma.user.update({
      where: { id: id.owner },
      data: { aiFeaturesEnabled: false },
    })
    const denied = await call('/chat', {
      ...body,
      assistantMessageId: randomUUID(),
    })
    assert.equal(denied.response.status, 403)
    assert.deepEqual(fixtures.stats(), beforeReplay)
    await prisma.user.update({
      where: { id: id.owner },
      data: { aiFeaturesEnabled: true },
    })
    checks.push('ineligible-owner-zero-dispatch')
    const beforeModeDenial = fixtures.stats()
    const nonTutor = await call('/chat', {
      ...body,
      assistantMessageId: randomUUID(),
      selectedMode: 'explainer',
      allowRegeneration: true,
    })
    assert.equal(nonTutor.response.status, 200)
    assert.equal(fixtures.stats().codeApiCalls, beforeModeDenial.codeApiCalls)
    assert.equal(fixtures.stats().modelCalls, beforeModeDenial.modelCalls + 1)
    checks.push('non-tutor-zero-codeapi-dispatch')
    await stopChild(api)
    await startApi(true, ['synthetic-other-pilot'])
    const beforePilotDenial = fixtures.stats()
    const unallowlisted = await call('/chat', {
      ...body,
      assistantMessageId: randomUUID(),
      allowRegeneration: true,
    })
    assert.equal(unallowlisted.response.status, 200)
    assert.equal(fixtures.stats().codeApiCalls, beforePilotDenial.codeApiCalls)
    assert.equal(fixtures.stats().modelCalls, beforePilotDenial.modelCalls + 1)
    checks.push('unallowlisted-zero-codeapi-dispatch')
    await stopChild(api)
    await startApi(false)
    const disabled = await call('/chat', {
      ...body,
      assistantMessageId: randomUUID(),
      allowRegeneration: true,
    })
    assert.equal(disabled.response.status, 200)
    assert.equal(fixtures.stats().codeApiCalls, 1)
    assert.equal(fixtures.stats().violations, 0)
    checks.push('disabled-gate-zero-new-codeapi-dispatch')
    if (setup.browser) {
      phase = 'browser-acceptance'
      await stopChild(api)
      await startApi(true)
      receipt('browser-ready.json', {
        generation: setup.generation,
        username,
        chatbotId: id.bot,
        answer: fixtures.answer,
      })
      let lastSequence = 0
      await waitFor(async () => {
        if (existsSync(join(directory, 'browser-result.json'))) return true
        if (!existsSync(join(directory, 'browser-control.json'))) return false
        const command = readReceipt('browser-control.json')
        assert.equal(command.generation, setup.generation)
        if (command.sequence <= lastSequence) return false
        assert.equal(command.sequence, lastSequence + 1)
        if (command.action === 'disable') {
          await stopChild(api)
          await startApi(false)
        } else if (command.action !== 'stats')
          fixtures.setBehavior(command.action)
        lastSequence = command.sequence
        receipt('browser-ack.json', {
          generation: setup.generation,
          sequence: lastSequence,
          stats: fixtures.browserStats(),
        })
        return false
      }, 600000)
      assert.equal(readReceipt('browser-result.json').status, 'passed')
      const stopped = await prisma.chatMessage.findMany({
        where: {
          thread: { chatbotId: id.bot, participantId: id.participant },
          lifecycleStatus: 'COMPLETED',
        },
        select: { content: true },
      })
      assert(
        stopped.some((message) =>
          message.content.some(
            (part) => part.type === 'data' && part.name === 'chat-stopped'
          )
        )
      )
      checks.push('browser-enabled-reload-stop-recovery-and-disabled')
    }
    receipt('acceptance.json', {
      status: 'passed',
      generation: setup.generation,
      checks,
      stats: fixtures.stats(),
      httpCalls,
      limitations: [
        'deterministic local provider and execution transports',
        'no real Python or guest-termination proof',
        ...(setup.browser
          ? []
          : ['browser acceptance not included in this run']),
      ],
    })
  } catch (error) {
    receipt('acceptance.json', {
      status: 'failed',
      generation: setup.generation,
      checks,
      error:
        error.name === 'AssertionError'
          ? 'assertion-failed'
          : 'qualification-failed',
      phase,
      lastHttpStatus,
      lastHttpCode,
      lastCompletedCheck: checks.at(-1) ?? null,
      stats: fixtures?.stats() ?? null,
      assertionOperator: error.operator ?? null,
      errorCode: typeof error.code === 'string' ? error.code : null,
    })
    throw new Error('Local qualification failed; inspect the private receipt')
  } finally {
    let stopped = false
    try {
      await stopChild(api)
      stopped = true
    } finally {
      if (fixtures) await fixtures.close()
      if (owned && stopped) {
        await requireDisposableDatabase(prisma)
        await prisma.participant.deleteMany({
          where: { id: id.participant, username },
        })
        await prisma.user.deleteMany({
          where: {
            id: id.owner,
            shortname: tag,
            email: `${tag}@example.invalid`,
          },
        })
      }
      await prisma.$disconnect()
      receipt('worker-cleanup.json', {
        apiStopped: stopped,
        fixturesStopped: true,
        ownedRowsCleaned: owned && stopped,
      })
    }
  }
}

async function browserQualification(setup, generation) {
  await waitFor(() => existsSync(join(directory, 'browser-ready.json')), 60000)
  const binding = readReceipt('browser-ready.json')
  assert.equal(binding.generation, generation)
  const activated = spawnSync(
    'devrouter',
    ['ensure', root, '--profile', 'chat,chat-api', '--json'],
    { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 }
  )
  assert.equal(
    activated.status,
    0,
    'Direct API profile did not reach readiness'
  )
  receipt('browser-runtime.json', JSON.parse(activated.stdout))
  const session = `chat-catalyst-${generation.slice(0, 8)}`
  let sequence = 0
  const completed = []
  let browserStep = null
  let browserError = null
  const browser = (...args) => {
    browserStep = args[0]
    const result = spawnSync(
      'agent-browser',
      ['--session', session, '--ignore-https-errors', ...args],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 45000,
        maxBuffer: 256 * 1024,
        env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '30000' },
      }
    )
    if (result.status !== 0) {
      const output = `${result.stderr ?? ''} ${result.stdout ?? ''}`
      browserError = /Timeout|timed out/i.test(output)
        ? 'timeout'
        : /Target closed/i.test(output)
          ? 'browser-runtime'
          : 'command-failed'
    }
    assert.equal(result.status, 0, `Browser command failed: ${args[0]}`)
    return result.stdout.trim()
  }
  const control = async (action) => {
    receipt('browser-control.json', {
      generation,
      sequence: ++sequence,
      action,
    })
    await waitFor(
      () =>
        existsSync(join(directory, 'browser-ack.json')) &&
        readReceipt('browser-ack.json').sequence === sequence,
      30000
    )
    return readReceipt('browser-ack.json').stats
  }
  const waitText = (text) => {
    browser(
      'wait',
      '--fn',
      `document.querySelector('[data-cy="chat-assistant-message-content"]') && document.body.innerText.includes(${JSON.stringify(text)})`
    )
    browser(
      'wait',
      '--fn',
      `document.querySelector('[data-cy="chat-cancel-button"]')?.hasAttribute('inert') === true`
    )
  }
  const send = (text) => {
    browser('fill', '[data-cy="chat-composer-input"]', text)
    browser('click', '[data-cy="chat-send-button"]')
  }
  try {
    browser('open', `${setup.chatOrigin}/noLogin`)
    const authenticated = browser(
      'eval',
      `(async () => {
        const response = await fetch(${JSON.stringify(`${setup.backendOrigin}/api/graphql`)}, {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-graphql-yoga-csrf': 'true' },
          body: JSON.stringify({
            query: 'mutation LoginParticipant($usernameOrEmail: String!, $password: String!) { loginParticipant(usernameOrEmail: $usernameOrEmail, password: $password) }',
            variables: { usernameOrEmail: ${JSON.stringify(binding.username)}, password: 'synthetic-local-browser-password' }
          })
        })
        const result = await response.json()
        return response.ok && !!result.data?.loginParticipant && !result.errors
      })()`
    )
    assert.equal(authenticated, 'true', 'Existing participant login failed')
    completed.push('real-browser-login-cookie')
    browser('open', `${setup.chatOrigin}/${binding.chatbotId}`)
    browser('wait', '[data-cy="chat-composer-input"]')
    const selectedOrigin = browser('get', 'attr', 'html', 'data-chat-api-url')
    assert(selectedOrigin.includes(setup.apiOrigin))
    completed.push('direct-api-runtime-binding')
    browser('click', '[data-cy="chat-new-thread-button"]')
    browser(
      'wait',
      '--fn',
      `document.querySelectorAll('[data-cy="chat-assistant-message-content"]').length === 0`
    )
    let previous = await control('stats')
    send('Use the Python tool for this synthetic calculation.')
    waitText(binding.answer)
    let next = await control('stats')
    assert.equal(next.codeApiCalls, previous.codeApiCalls + 1)
    completed.push('browser-python-result')
    browser('reload')
    waitText(binding.answer)
    previous = await control('stats')
    assert.equal(previous.codeApiCalls, next.codeApiCalls)
    assert.equal(previous.modelCalls, next.modelCalls)
    completed.push('reload-no-new-execution')
    await control('cancel')
    send('Run the next synthetic calculation and wait for Stop.')
    await waitFor(
      async () =>
        (await control('stats')).codeApiCalls === previous.codeApiCalls + 1,
      30000
    )
    browser('click', '[data-cy="chat-cancel-button"]')
    await waitFor(
      async () => (await control('stats')).cancelledCalls === 1,
      30000
    )
    browser('wait', '[data-cy="chat-message-stopped"]')
    completed.push('browser-stop-cancels-transport')
    await control('success')
    send('Recover with another Python calculation.')
    browser(
      'wait',
      '--fn',
      `document.querySelectorAll('[data-cy="chat-assistant-message-content"]').length >= 3 && !document.querySelector('[data-cy="chat-cancel-button"]:not([inert])')`
    )
    next = await control('stats')
    assert.equal(next.codeApiCalls, previous.codeApiCalls + 2)
    completed.push('browser-recovery')
    await control('failure')
    previous = await control('stats')
    send('Report the synthetic execution-service failure without retrying.')
    waitText('synthetic-service-unavailable')
    next = await control('stats')
    assert.equal(next.codeApiCalls, previous.codeApiCalls + 1)
    assert.equal(next.modelCalls, previous.modelCalls + 2)
    completed.push('browser-service-failure-single-attempt')
    await control('disable')
    previous = await control('stats')
    send('Answer without Python when the feature is disabled.')
    waitText('synthetic-without-tool')
    next = await control('stats')
    assert.equal(next.codeApiCalls, previous.codeApiCalls)
    assert.equal(next.violations, 0)
    completed.push('browser-disabled-no-codeapi')
    receipt('browser-result.json', {
      generation,
      status: 'passed',
      completed,
      stats: next,
    })
  } catch {
    receipt('browser-result.json', {
      generation,
      status: 'failed',
      completed,
      browserStep,
      browserError,
    })
    throw new Error('Browser qualification failed at its recorded boundary')
  } finally {
    spawnSync('agent-browser', ['--session', session, 'close'], {
      cwd: root,
      stdio: 'ignore',
      timeout: 20000,
    })
  }
}

async function host() {
  const context = realpathSync(process.argv[4] ?? '')
  const catalystSource = realpathSync(process.argv[5] ?? '')
  const revision = process.argv[6]
  assert(
    /^[0-9a-f]{40}$/.test(revision ?? ''),
    'An exact Catalyst revision is required'
  )
  const git = (...args) => {
    const result = spawnSync('git', ['-C', catalystSource, ...args], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    assert.equal(result.status, 0, 'Catalyst source qualification failed')
    return result.stdout.trim()
  }
  assert.equal(git('rev-parse', 'HEAD'), revision)
  git('diff', '--exit-code', revision, '--', 'apps/tutoring-engine/src')
  const sourceFiles = git(
    'ls-tree',
    '-r',
    '--name-only',
    revision,
    '--',
    'apps/tutoring-engine/src'
  ).split('\n')
  assert(sourceFiles.length > 0)
  for (const path of sourceFiles)
    assert.deepEqual(
      readFileSync(join(context, path)),
      readFileSync(join(catalystSource, path)),
      'Qualified engine source differs'
    )
  const expectedMastra = JSON.parse(
    readFileSync(join(catalystSource, 'apps/tutoring-engine/package.json'))
  ).dependencies['@mastra/core']
  assert.equal(
    JSON.parse(
      readFileSync(
        join(
          context,
          'apps/tutoring-engine/node_modules/@mastra/core/package.json'
        )
      )
    ).version,
    expectedMastra
  )
  const engineSource = join(
    context,
    'apps/tutoring-engine/dist/server-runtime.js'
  )
  assert(
    existsSync(engineSource),
    'A previously qualified Catalyst build context is required'
  )
  const runtimeDescriptor = openSync(
    join(dirname(directory), 'runtime-ensure.json'),
    constants.O_RDONLY | constants.O_NOFOLLOW
  )
  let ensured
  try {
    ensured = JSON.parse(readFileSync(runtimeDescriptor, 'utf8'))
  } finally {
    closeSync(runtimeDescriptor)
  }
  assert.equal(realpathSync(ensured.repoPath), root)
  const generation = randomUUID()
  const workspace = ensured.workspace
  assert(/^[a-z0-9-]+$/.test(workspace))
  const engineName = `${workspace}-catalyst-qualification-${generation.slice(0, 8)}`
  const engineAlias = `${workspace}-catalyst-qualification`
  const engineUrl = `http://${engineAlias}:3015`
  const browser = process.argv.includes('--browser')
  const chatOrigin = `https://chat.klicker.${workspace}.localhost`
  const apiOrigin = `https://chat-api.klicker.${workspace}.localhost`
  const pwaOrigin = `https://pwa.klicker.${workspace}.localhost`
  const backendOrigin = `https://api.klicker.${workspace}.localhost`
  const mapped = spawnSync(
    'devrouter',
    [
      'exec',
      root,
      '--',
      'node',
      '-e',
      'process.stdout.write(JSON.stringify({root:process.cwd()}))',
    ],
    { cwd: root, encoding: 'utf8', timeout: 20000 }
  )
  assert.equal(mapped.status, 0, 'Container workspace mapping is unavailable')
  const containerSourcePath = JSON.parse(mapped.stdout).root
  assert(
    typeof containerSourcePath === 'string' &&
      containerSourcePath.startsWith('/')
  )
  const relativeDirectory = relative(root, directory)
  mkdirSync(directory, { recursive: false })
  receipt('setup.json', {
    generation,
    sourcePath: root,
    containerSourcePath,
    fixtureHost: `${workspace}-app`,
    engineUrl,
    browser,
    chatOrigin,
    apiOrigin,
    pwaOrigin,
  })
  let engine
  let workerProcess
  try {
    const build = spawnSync(
      'devrouter',
      [
        'exec',
        root,
        '--',
        'pnpm',
        '--filter',
        '@klicker-uzh/chat-api',
        'build',
      ],
      { cwd: root, stdio: 'ignore', timeout: 60000 }
    )
    assert.equal(build.status, 0, 'API build in the managed runtime failed')
    workerProcess = spawn(
      'devrouter',
      [
        'exec',
        root,
        '--',
        'env',
        'CHAT_API_QUALIFICATION=1',
        'node',
        'util/run-chat-api-qualification.mjs',
        '--start-worker',
        relativeDirectory,
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] }
    )
    await waitFor(() => {
      if (workerProcess.exitCode !== null && workerProcess.exitCode !== 0)
        throw new Error('Fixture worker exited early')
      return existsSync(join(directory, 'fixtures.json'))
    }, 30000)
    const fixtures = readReceipt('fixtures.json')
    assert.equal(fixtures.generation, generation)
    const environment = {
      ...fixtures.publicEnvironment,
      CATALYST_ENGINE_PROVIDER_API_KEY: SYNTHETIC_PROVIDER_TOKEN,
      CATALYST_ENGINE_SERVICE_TOKEN: SYNTHETIC_SERVICE_TOKEN,
      CATALYST_ENGINE_MCP_EXECUTION_URL:
        'http://127.0.0.1:3015/v1/tools/codeapi',
      NODE_EXTRA_CA_CERTS: '/fixture-ca.pem',
      PORT: '3015',
    }
    engine = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        engineName,
        '--label',
        `chat-qualification-generation=${generation}`,
        '--network',
        'devnet',
        '--network-alias',
        engineAlias,
        '--mount',
        `type=bind,source=${context},target=/engine,readonly`,
        '--mount',
        `type=bind,source=${join(directory, 'fixture-ca.pem')},target=/fixture-ca.pem,readonly`,
        '--workdir',
        '/engine/apps/tutoring-engine',
        ...Object.entries(environment).flatMap(([key, value]) => [
          '--env',
          `${key}=${value}`,
        ]),
        'node:24.21.0-bookworm',
        'node',
        'dist/server-runtime.js',
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] }
    )
    if (browser)
      await browserQualification(
        { chatOrigin, apiOrigin, pwaOrigin, backendOrigin },
        generation
      )
    await waitFor(
      () => existsSync(join(directory, 'worker-cleanup.json')),
      browser ? 780000 : 150000
    )
    assert.equal(readReceipt('acceptance.json').status, 'passed')
    assert.equal(readReceipt('worker-cleanup.json').apiStopped, true)
    const verified = spawnSync(
      'devrouter',
      [
        'exec',
        root,
        '--',
        'node',
        'util/run-chat-api-qualification.mjs',
        '--verify-worker-stopped',
        relativeDirectory,
      ],
      { cwd: root, stdio: 'ignore', timeout: 20000 }
    )
    assert.equal(verified.status, 0, 'Owned worker shutdown is unproved')
    console.log(
      browser
        ? 'Local HTTP/Prisma/Catalyst and browser qualification passed.'
        : 'HTTP/Prisma/Catalyst qualification passed; browser acceptance is still pending.'
    )
  } finally {
    if (
      workerProcess &&
      existsSync(join(directory, 'worker-owner.json')) &&
      !existsSync(join(directory, 'worker-cleanup.json'))
    ) {
      const cleanup = spawnSync(
        'devrouter',
        [
          'exec',
          root,
          '--',
          'node',
          'util/run-chat-api-qualification.mjs',
          '--stop-worker',
          relativeDirectory,
        ],
        { cwd: root, stdio: 'ignore', timeout: 20000 }
      )
      if (cleanup.status !== 0)
        receipt('worker-stop-failure.json', {
          generation,
          state: 'cleanup-unproved',
        })
    }
    await stopChild(workerProcess)
    if (engine) {
      spawnSync('docker', ['stop', '--time', '15', engineName], {
        stdio: 'ignore',
        timeout: 20000,
      })
      await stopChild(engine)
    }
  }
}

try {
  if (mode === '--verify-worker-stopped') {
    const owner = readReceipt('worker-owner.json')
    const setup = readReceipt('setup.json')
    assert.equal(owner.generation, setup.generation)
    assert.equal(owner.containerSourcePath, root)
    assert(Number.isInteger(owner.pid) && owner.pid > 1)
    const status = `/proc/${owner.pid}/stat`
    assert(
      !existsSync(status) ||
        readFileSync(status, 'utf8').split(') ')[1]?.startsWith('Z '),
      'Owned worker is still active'
    )
  } else if (mode === '--start-worker') {
    assert.equal(process.env.CHAT_API_QUALIFICATION, '1')
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), '--worker', directory],
      { cwd: root, env: process.env, detached: true, stdio: 'ignore' }
    )
    await once(child, 'spawn')
    child.unref()
    console.log('Owned qualification worker started')
  } else if (mode === '--stop-worker') {
    const owner = readReceipt('worker-owner.json')
    const setup = readReceipt('setup.json')
    assert.equal(owner.containerSourcePath, root)
    assert.equal(owner.sourcePath, setup.sourcePath)
    assert.equal(owner.generation, setup.generation)
    assert(Number.isInteger(owner.pid) && owner.pid > 1)
    if (!existsSync(join(directory, 'worker-cleanup.json'))) {
      const command = readFileSync(`/proc/${owner.pid}/cmdline`, 'utf8').split(
        '\0'
      )
      assert(
        command.some(
          (argument) =>
            resolve(root, argument) === fileURLToPath(import.meta.url)
        ) &&
          command.includes('--worker') &&
          command.some((argument) => resolve(root, argument) === directory)
      )
      process.kill(owner.pid, 'SIGTERM')
      await waitFor(
        () => existsSync(join(directory, 'worker-cleanup.json')),
        15000
      )
    }
  } else if (mode === '--worker') await worker()
  else if (mode === '--host') await host()
  else
    throw new Error(
      'Use --host <new-private-run-directory> <qualified-engine-context> <catalyst-source> <full-revision>'
    )
} catch {
  console.error(
    'Qualification did not complete; private receipts preserve the failed boundary.'
  )
  process.exitCode = 1
}
