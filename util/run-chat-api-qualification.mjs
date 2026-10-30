import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import {
  closeSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
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
if (mode === '--worker' || mode === '--host') {
  process.once('SIGTERM', () => shutdown.abort())
  process.once('SIGINT', () => shutdown.abort())
  setTimeout(() => shutdown.abort(), 1980000).unref()
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
  const { prisma, requireDisposableDatabase } = await import(
    '../packages/prisma/dist/index.js'
  )
  const { deriveElearningLearnerBinding, signJWT, getZurichMonthStart } =
    await import('../packages/util/dist/index.js')
  await requireDisposableDatabase(prisma)
  const id = Object.fromEntries(
    ['owner', 'participant', 'course', 'bot', 'server', 'kb', 'build'].map(
      (key) => [key, randomUUID()]
    )
  )
  const tag = `chat-qualification-${setup.generation}`
  const mcpName = `qual_${setup.generation.slice(0, 8)}`
  const children = new Set()
  let api, next, fixtures, graphClient, graph
  let owned = false
  let phase = 'seed'
  const checks = []
  receipt('worker-owner.json', {
    generation: setup.generation,
    sourcePath: setup.sourcePath,
    containerSourcePath: root,
    pid: process.pid,
  })
  const start = (path, environment, label, cwd = root) => {
    const log = join(directory, `${label}.log`)
    const child = spawn(process.execPath, [path], {
      cwd,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Process logs are local diagnostics and never embedded in receipts or CI.
    const chunks = []
    let bytes = 0
    const capture = (chunk) => {
      if ((bytes += chunk.length) <= 1024 * 1024) chunks.push(chunk)
    }
    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    child.on('exit', () =>
      writeFileSync(log, Buffer.concat(chunks), { mode: 0o600 })
    )
    child.on('error', () => {})
    children.add(child)
    return child
  }
  const ready = async (url, child) =>
    waitFor(async () => {
      if (child?.exitCode !== null && child?.exitCode !== undefined)
        throw new Error('Owned process exited before readiness')
      try {
        return (
          await fetch(url, {
            headers: { authorization: `Bearer ${SYNTHETIC_SERVICE_TOKEN}` },
            signal: AbortSignal.timeout(3000),
          })
        ).ok
      } catch {
        return false
      }
    }, 60000)
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
        answerPreferencesEnabled: true,
        knowledgeGraphVisible: true,
        allowedModelIds: ['gpt-6-luna'],
        creditInitialCredits: 10,
        creditMaxCredits: 10,
        creditResetPeriod: 'NONE',
      },
    })
    await prisma.participant.create({
      data: {
        id: id.participant,
        username: tag,
        password: 'synthetic-unusable-password',
      },
    })
    await prisma.participation.create({
      data: {
        courseId: id.course,
        participantId: id.participant,
        isActive: true,
      },
    })
    await prisma.chatAccountUsage.create({
      data: {
        ownerId: id.owner,
        usageClass: 'BASE',
        monthStart: getZurichMonthStart(new Date()),
        budgetCredits: 10,
        usedCredits: 0,
      },
    })
    const graphRequire = createRequire(
      join(root, 'packages/knowledge-graph/package.json')
    )
    const { FalkorDB } = graphRequire('falkordb')
    graphClient = await FalkorDB.connect({
      socket: { host: setup.graphHost, port: 6379, connectTimeout: 3000 },
    })
    const { computeKBContentDigest, getKnowledgeGraphName } = await import(
      '../packages/knowledge-graph/dist/index.js'
    )
    await prisma.kB.create({
      data: {
        id: id.kb,
        ownerId: id.owner,
        name: tag,
        knowledgeGraphEnabled: true,
      },
    })
    const graphName = getKnowledgeGraphName(id.kb, id.build)
    graph = graphClient.selectGraph(graphName)
    await graph.query(
      "CREATE (a:Concept {name:'Synthetic alpha'}), (b:Concept {name:'Synthetic beta'}), (a)-[:RELATED {description:'Synthetic relation'}]->(b)"
    )
    await prisma.kBGraphBuild.create({
      data: {
        id: id.build,
        kbId: id.kb,
        status: 'SUCCEEDED',
        graphName,
        sourceContentDigest: await computeKBContentDigest(prisma, id.kb),
      },
    })
    await prisma.kB.update({
      where: { id: id.kb },
      data: { publishedGraphBuildId: id.build },
    })
    await prisma.kBChatbot.create({ data: { kbId: id.kb, chatbotId: id.bot } })
    fixtures = await startQualificationFixtures({
      hostname: setup.fixtureHost,
      chatbotId: id.bot,
      participantId: id.participant,
      courseId: id.course,
      mcpName,
    })
    fixtures.setScenario('calculator')
    await prisma.chatbotMCPServer.create({
      data: {
        id: id.server,
        name: mcpName,
        url: fixtures.courseUrl,
        authType: 'none',
        passChatbotId: true,
        chatbotIdHeader: 'x-qualification-chatbot',
      },
    })
    await prisma.chatbotMCPConfig.create({
      data: {
        chatbotId: id.bot,
        mcpServerId: id.server,
        chatMode: 'tutor',
        allowedTools: ['doc_query'],
        isEnabled: false,
      },
    })
    const common = {
      OPENAI_BASE_URL: fixtures.localProviderOrigin + '/v1',
      OPENAI_API_KEY: SYNTHETIC_PROVIDER_TOKEN,
      CHAT_CODEAPI_ENABLED: 'false',
      APP_SECRET: 'synthetic-qualification-app-secret',
      APP_CHAT_GUEST_SECRET: 'synthetic-qualification-guest-secret',
      ELEARNING_CHAT_HANDOFF_SECRET: 'synthetic-qualification-elearning-secret',
      CHAT_TURN_LIFECYCLE_WRITES_ENABLED: 'true',
      CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED: 'true',
      LANGFUSE_TRACING_ENABLED: 'false',
      GROWTHBOOK_API_HOST: 'http://127.0.0.1:1',
      GROWTHBOOK_CLIENT_KEY: '',
      MCP_STUDENT_URL: fixtures.studentPracticeUrl,
      KB_FALKORDB_HOST: setup.graphHost,
      KB_FALKORDB_PORT: '6379',
      KB_FALKORDB_USERNAME: '',
      KB_FALKORDB_PASSWORD: '',
      KB_FALKORDB_TLS: 'false',
    }
    process.env.APP_CHAT_GUEST_SECRET = common.APP_CHAT_GUEST_SECRET
    process.env.APP_SECRET = common.APP_SECRET
    const jwt = await signJWT(
      { sub: id.participant, role: 'PARTICIPANT' },
      process.env.APP_SECRET,
      { issuer: process.env.APP_ORIGIN_API, expiresIn: '45m' }
    )
    const { signPwaEmbedSessionToken } = await import(
      '../apps/chat-api/dist/host/lib/server/pwaEmbed.js'
    )
    const { signChatGuestToken } = await import(
      '../apps/chat-api/dist/host/lib/server/chatGuestToken.js'
    )
    const embedToken = await signPwaEmbedSessionToken({
      participantId: id.participant,
      chatbotId: id.bot,
      courseId: id.course,
    })
    const guestToken = await signChatGuestToken(id.participant)
    const learnerBinding = deriveElearningLearnerBinding(
      common.ELEARNING_CHAT_HANDOFF_SECRET,
      `synthetic-learner-${setup.generation}`
    )
    const elearningSession = await signPwaEmbedSessionToken({
      participantId: id.participant,
      chatbotId: id.bot,
      courseId: id.course,
      learnerBinding,
    })
    const elearningHeaders = {
      'content-type': 'application/json',
      authorization: `Bearer ${elearningSession}`,
      origin: setup.chatOrigin,
    }
    const signSnapshot = async (
      snapshot,
      binding,
      expired = false,
      target = {}
    ) => {
      const now = Math.floor(Date.now() / 1000)
      return signJWT(
        {
          sub: binding,
          scope: 'ELEARNING_SNAPSHOT',
          purpose: 'learning-context',
          aud: 'klicker-chat',
          chatbotId: target.chatbotId ?? id.bot,
          klickerCourseId: target.courseId ?? id.course,
          snapshot,
          exp: now + (expired ? -60 : 300),
        },
        common.ELEARNING_CHAT_HANDOFF_SECRET,
        {
          issuer: 'elearning',
          issuedAt: new Date((now - (expired ? 120 : 0)) * 1000),
        }
      )
    }
    const authHeaders = {
      cookie: `participant_token=${jwt}`,
      'content-type': 'application/json',
      origin: setup.chatOrigin,
    }
    const state = {
      cookies: [
        {
          name: 'participant_token',
          value: jwt,
          domain: '127.0.0.1',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 2700,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }
    receipt('browser-auth-state.json', state)
    receipt('fixtures.json', {
      generation: setup.generation,
      engineEnvironment: {
        ...fixtures.engineEnvironment,
        CATALYST_ENGINE_CODEAPI_ENABLED: 'false',
        CATALYST_ENGINE_MCP_EXECUTION_URL: `http://${setup.fixtureHost}:3005/v2/tools/execute`,
        CATALYST_ENGINE_OBSERVABILITY: 'off',
        PORT: '3015',
      },
    })
    const defaultEngine = start(
      join(root, 'apps/chat-engine-default/dist/index.js'),
      {
        ...common,
        CHAT_ENGINE_SERVICE_TOKEN: SYNTHETIC_SERVICE_TOKEN,
        MCP_EXECUTION_URL: 'http://127.0.0.1:3005/v2/tools/execute',
        PORT: '3016',
      },
      'default-engine'
    )
    await ready('http://127.0.0.1:3016/health', defaultEngine)
    await ready(setup.engineUrl + '/v2/manifest')
    const standalone = join(root, 'apps/chat/.next/standalone/apps/chat')
    assert(
      existsSync(join(standalone, 'server.js')),
      'A built Next standalone app is required'
    )
    cpSync(join(root, 'apps/chat/public'), join(standalone, 'public'), {
      recursive: true,
    })
    cpSync(
      join(root, 'apps/chat/.next/static'),
      join(standalone, '.next/static'),
      { recursive: true }
    )
    const startNext = async (variant) => {
      await stopChild(next)
      next = start(
        join(standalone, 'server.js'),
        {
          ...common,
          NODE_ENV: 'production',
          PORT: '3004',
          HOSTNAME: '0.0.0.0',
          CHAT_DIRECT_API_ENABLED: variant === 'legacy' ? 'false' : 'true',
          CHAT_PUBLIC_API_URL: setup.apiOrigin,
        },
        `next-${variant}`,
        standalone
      )
      await ready('http://127.0.0.1:3004/noLogin', next)
    }
    const startApi = async (variant) => {
      await stopChild(api)
      api = start(
        join(root, 'apps/chat-api/dist/index.js'),
        {
          ...common,
          CHAT_BROWSER_ALLOWED_ORIGINS: setup.chatOrigin,
          CHAT_ENGINE_URL:
            variant === 'catalyst' ? setup.engineUrl : 'http://127.0.0.1:3016',
          CHAT_ENGINE_ID:
            variant === 'catalyst' ? QUALIFICATION_ENGINE_ID : 'public-ai-sdk',
          CHAT_ENGINE_SERVICE_TOKEN: SYNTHETIC_SERVICE_TOKEN,
          PORT: '3005',
        },
        `api-${variant}`
      )
      await ready('http://127.0.0.1:3005/ready', api)
    }
    let requests = 0
    const call = async (variant, suffix, data, options = {}) => {
      assert(++requests <= 200, 'Qualification request bound exceeded')
      const response = await fetch(
        `http://127.0.0.1:${variant === 'legacy' ? 3004 : 3005}/api/chatbots/${id.bot}${suffix}`,
        {
          method: data === undefined ? 'GET' : 'POST',
          headers: authHeaders,
          ...(data === undefined ? {} : { body: JSON.stringify(data) }),
          signal: AbortSignal.any([
            shutdown.signal,
            AbortSignal.timeout(45000),
          ]),
          redirect: 'error',
          ...options,
        }
      )
      const text = await response.text()
      assert(Buffer.byteLength(text) < 4 * 1024 * 1024)
      return { status: response.status, text, headers: response.headers }
    }
    const frames = (text) =>
      text
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
        .map((line) => JSON.parse(line.slice(6)))
    const thread = () =>
      prisma.chatThread.create({
        data: { participantId: id.participant, chatbotId: id.bot },
      })
    const question = (threadId, extra = {}) => ({
      threadId,
      selectedModel: 'gpt-6-luna',
      selectedMode: 'tutor',
      reasoningEffort: 'low',
      assistantMessageId: randomUUID(),
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          content: 'synthetic-history-marker: calculate one plus one.',
        },
      ],
      ...extra,
    })
    const verifyTurn = async (variant, body, options = {}) => {
      const response = await call(variant, '/chat', body, options)
      if (response.status !== 200) {
        let code = null
        try {
          const value = JSON.parse(response.text).code
          if (typeof value === 'string' && /^[A-Z_]{1,80}$/.test(value))
            code = value
        } catch {}
        receipt('last-denial.json', {
          variant,
          phase,
          status: response.status,
          code,
        })
      }
      assert.equal(
        response.status,
        200,
        `${variant} turn HTTP ${response.status}`
      )
      const events = frames(response.text)
      assert(
        !events.some((event) => event.type === 'error'),
        `${variant} stream error`
      )
      assert.equal(events.filter((event) => event.type === 'finish').length, 1)
      const stored = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: body.assistantMessageId },
      })
      assert.equal(stored.lifecycleStatus, 'COMPLETED')
      assert(
        stored.content.some(
          (part) => part.type === 'text' && part.text.includes(fixtures.answer)
        )
      )
      assert(stored.creditsUsed.toNumber() > 0)
      return { response, events, stored }
    }
    for (const variant of ['legacy', 'default', 'catalyst']) {
      phase = `${variant}:startup`
      await startApi(variant)
      await startNext(variant)
      const variantChecks = []
      phase = `${variant}:disclaimer`
      const disclaimer = await call(variant, '/disclaimer')
      assert.equal(
        disclaimer.status,
        200,
        `${variant} disclaimer HTTP ${disclaimer.status}`
      )
      const consent = JSON.parse(disclaimer.text)
      if (consent.status.required && !consent.status.accepted) {
        assert(consent.disclaimer?.id)
        assert.equal(
          (
            await call(variant, '/disclaimer', {
              action: 'accept',
              disclaimerId: consent.disclaimer.id,
            })
          ).status,
          200
        )
      }
      variantChecks.push('disclaimer-accepted-through-participant-api')
      const capabilities = await call(variant, '')
      assert.equal(capabilities.status, 200)
      assert.equal(JSON.parse(capabilities.text).answerPreferencesEnabled, true)
      phase = `${variant}:thread-crud`
      const created = await call(variant, '/threads', {
        title: 'Synthetic qualification thread',
      })
      assert.equal(created.status, 200)
      const createdThread = JSON.parse(created.text)
      assert.equal(typeof createdThread.id, 'string')
      assert.equal(createdThread.origin, null)
      let listed = await call(variant, '/threads')
      assert.equal(listed.status, 200)
      assert(
        JSON.parse(listed.text).some((item) => item.id === createdThread.id)
      )
      const renamed = await call(
        variant,
        `/threads/${createdThread.id}/title`,
        { title: 'Renamed synthetic thread' },
        { method: 'PUT' }
      )
      assert.equal(renamed.status, 200)
      assert.equal(
        JSON.parse(renamed.text).thread.title,
        'Renamed synthetic thread'
      )
      const removed = await call(
        variant,
        `/threads/${createdThread.id}`,
        undefined,
        { method: 'DELETE' }
      )
      assert.equal(removed.status, 200)
      listed = await call(variant, '/threads')
      assert.equal(listed.status, 200)
      assert(
        !JSON.parse(listed.text).some((item) => item.id === createdThread.id)
      )
      assert.equal(
        (
          await call(variant, `/threads/${createdThread.id}`, undefined, {
            method: 'DELETE',
          })
        ).status,
        404
      )
      variantChecks.push('participant-thread-create-list-rename-delete')
      const counts = fixtures.stats()
      const basicThread = await thread()
      const body = question(basicThread.id)
      body.answerStyle = 'bullets'
      body.answerTone = 'friendly'
      phase = `${variant}:calculator`
      fixtures.setScenario('calculator')
      await verifyTurn(variant, body)
      assert.equal(
        fixtures.stats().calculatorResults,
        counts.calculatorResults + 1
      )
      assert.equal(fixtures.stats().codeApiCalls, 0)
      variantChecks.push('actual-calculator-loop-and-persisted-charge')
      const after = fixtures.stats()
      const replay = await call(variant, '/chat', body)
      assert.equal(replay.status, 409)
      assert.deepEqual(fixtures.stats(), after)
      variantChecks.push('duplicate-zero-model-tool-or-charge')
      for (const rating of ['UP', null]) {
        const feedback = await call(
          variant,
          `/threads/${body.threadId}/messages/${body.assistantMessageId}/feedback`,
          { rating }
        )
        assert.equal(feedback.status, 200)
        assert.equal(JSON.parse(feedback.text).rating, rating)
        const saved = await prisma.chatMessage.findUniqueOrThrow({
          where: { id: body.assistantMessageId },
          select: { rating: true },
        })
        assert.equal(saved.rating, rating)
      }
      assert.equal(
        (
          await call(
            variant,
            `/threads/${body.threadId}/messages/${body.messages[0].id}/feedback`,
            { rating: 'UP' }
          )
        ).status,
        404
      )
      const history = await call(variant, `/threads/${body.threadId}/messages`)
      assert.equal(history.status, 200)
      assert(
        JSON.parse(history.text).some(
          (message) => message.id === body.assistantMessageId
        )
      )
      variantChecks.push('reload-and-feedback')
      phase = `${variant}:identity`
      for (const token of [embedToken, guestToken]) {
        const result = await call(variant, '/credits', undefined, {
          headers: { authorization: `Bearer ${token}` },
        })
        assert.equal(result.status, 200)
      }
      const foreignToken = await signPwaEmbedSessionToken({
        participantId: id.participant,
        chatbotId: randomUUID(),
        courseId: id.course,
      })
      const forbidden = await call(variant, '/chat', question(basicThread.id), {
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${foreignToken}`,
        },
      })
      assert([401, 403].includes(forbidden.status))
      assert.deepEqual(fixtures.stats(), after)
      variantChecks.push('scoped-guest-embed-and-foreign-denial')
      phase = `${variant}:course-tool`
      await prisma.chatbotMCPConfig.updateMany({
        where: { chatbotId: id.bot, mcpServerId: id.server },
        data: { isEnabled: true },
      })
      fixtures.setScenario('course')
      const courseBody = question((await thread()).id)
      await verifyTurn(variant, courseBody)
      assert.equal(fixtures.stats().courseCalls, counts.courseCalls + 1)
      assert.equal(fixtures.stats().courseResults, counts.courseResults + 1)
      const original = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: courseBody.assistantMessageId },
      })
      assert(!JSON.stringify(original.content).includes('citation_index'))
      await prisma.chatbotMCPConfig.updateMany({
        where: { chatbotId: id.bot, mcpServerId: id.server },
        data: { isEnabled: false },
      })
      variantChecks.push('actual-course-tool-and-original-persistence')
      phase = `${variant}:context`
      fixtures.setScenario('plain')
      const contextBody = question((await thread()).id, {
        chatContext: {
          version: 1,
          source: 'pwa',
          surface: 'practice-quiz',
          locale: 'en',
          courseId: id.course,
          question: { contentPreview: 'synthetic-context-marker' },
        },
      })
      const beforeContext = fixtures.stats()
      await verifyTurn(variant, contextBody)
      assert(fixtures.stats().contextCalls > beforeContext.contextCalls)
      variantChecks.push('pwa-context-reaches-actual-model')
      phase = `${variant}:next-owned-graph-and-practice`
      const nextCall = async (suffix, data, headers = authHeaders) => {
        assert(++requests <= 200)
        const response = await fetch(
          `http://127.0.0.1:3004/api/chatbots/${id.bot}${suffix}`,
          {
            method: data === undefined ? 'GET' : 'POST',
            headers,
            ...(data === undefined ? {} : { body: JSON.stringify(data) }),
            signal: AbortSignal.timeout(15000),
          }
        )
        return { status: response.status, body: await response.json() }
      }
      const overview = await nextCall('/knowledge-graph?operation=overview')
      assert.equal(overview.status, 200)
      assert.equal(overview.body.kbId, id.kb)
      assert.equal(overview.body.buildId, id.build)
      assert.equal(overview.body.nodes.length, 2)
      assert.equal(overview.body.edges.length, 1)
      const search = await nextCall('/knowledge-graph?operation=search&q=alpha')
      assert.equal(search.status, 200)
      assert.equal(search.body.nodes.length, 1)
      const neighbors = await nextCall(
        `/knowledge-graph?operation=neighbors&nodeId=${search.body.nodes[0].id}&kbId=${id.kb}&buildId=${id.build}`
      )
      assert.equal(neighbors.status, 200)
      assert.equal(neighbors.body.nodes.length, 1)
      assert.equal(neighbors.body.edges.length, 1)
      const mentions = await nextCall('/knowledge-graph?operation=mentions', {
        text: 'Synthetic alpha and Synthetic beta',
      })
      assert.equal(mentions.status, 200)
      assert.equal(mentions.body.mentions.length, 2)
      assert.equal(
        (
          await nextCall(
            `/knowledge-graph?operation=overview&kbId=${randomUUID()}`
          )
        ).status,
        409
      )
      variantChecks.push('next-owned-published-native-graph-operations')
      fixtures.setScenario('practice')
      const practiceCounts = fixtures.stats()
      const practiceBody = question((await thread()).id)
      await verifyTurn(variant, practiceBody)
      assert.equal(
        fixtures.stats().practiceStarts,
        practiceCounts.practiceStarts + 1
      )
      assert.equal(
        fixtures.stats().practiceResults,
        practiceCounts.practiceResults + 1
      )
      const storedPractice = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: practiceBody.assistantMessageId },
      })
      const practiceResult = storedPractice.content.find(
        (part) =>
          part.type === 'tool-call' &&
          part.toolName === 'start_student_practice_quiz'
      )?.result
      assert.equal(practiceResult?.kind, 'student-practice-quiz')
      const submission = {
        questionRef: practiceResult.questionRef,
        responses: [
          { instanceId: 13, type: 'NUMERICAL', numericalResponse: 2 },
        ],
        stackAnswerTimeSeconds: 1,
      }
      for (const headers of [
        authHeaders,
        {
          'content-type': 'application/json',
          authorization: `Bearer ${embedToken}`,
        },
      ]) {
        const submitted = await nextCall(
          '/practice/submit',
          submission,
          headers
        )
        assert.equal(submitted.status, 200)
        assert.equal(submitted.body.stackId, 13)
      }
      assert.equal(
        fixtures.stats().practiceSubmissions,
        practiceCounts.practiceSubmissions + 2
      )
      variantChecks.push(
        'actual-practice-tool-projection-persistence-and-next-submit'
      )
      phase = `${variant}:signed-elearning`
      fixtures.setScenario('plain')
      const learningThreadResponse = await call(
        variant,
        '/threads',
        { title: 'Synthetic eLearning thread' },
        { headers: elearningHeaders }
      )
      assert.equal(learningThreadResponse.status, 200)
      const learningThread = JSON.parse(learningThreadResponse.text)
      assert.equal(learningThread.origin, 'elearning')
      const snapshot = (excerpt) => ({
        snapshotId: randomUUID(),
        observedAt: new Date().toISOString(),
        locale: 'en',
        location: { surface: 'block', blockIdent: 'synthetic-block' },
        material: { availability: 'full-text', excerpt },
      })
      const originalSnapshot = snapshot('synthetic-elearning-original-evidence')
      const liveSnapshot = snapshot('synthetic-elearning-live-evidence')
      const context = (envelope) => ({
        version: 1,
        source: 'elearning',
        locale: 'en',
        envelope,
      })
      const originalEnvelope = await signSnapshot(
        originalSnapshot,
        learnerBinding
      )
      const liveEnvelope = await signSnapshot(liveSnapshot, learnerBinding)
      const originalBody = question(learningThread.id, {
        chatContext: context(originalEnvelope),
      })
      let learningStats = fixtures.stats()
      await verifyTurn(variant, originalBody, { headers: elearningHeaders })
      assert(
        fixtures.stats().elearningOriginalCalls >
          learningStats.elearningOriginalCalls
      )
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      const originalId = originalBody.messages[0].id
      const savedContext = async (messageId) =>
        (
          await prisma.chatMessage.findUniqueOrThrow({
            where: { id: messageId },
            select: { learningContext: true },
          })
        ).learningContext
      assert.deepEqual(await savedContext(originalId), originalSnapshot)
      variantChecks.push('signed-elearning-snapshot-reaches-model-and-is-saved')

      phase = `${variant}:signed-elearning-denials`
      const parts = originalEnvelope.split('.')
      parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`
      const foreignBinding = deriveElearningLearnerBinding(
        common.ELEARNING_CHAT_HANDOFF_SECRET,
        `synthetic-foreign-learner-${setup.generation}`
      )
      const invalidEnvelopes = [
        parts.join('.'),
        await signSnapshot(originalSnapshot, learnerBinding, true),
        await signSnapshot(originalSnapshot, foreignBinding),
        await signSnapshot(originalSnapshot, learnerBinding, false, {
          chatbotId: randomUUID(),
        }),
        await signSnapshot(originalSnapshot, learnerBinding, false, {
          courseId: randomUUID(),
        }),
      ]
      for (const envelope of invalidEnvelopes) {
        const rejectedBody = question(learningThread.id, {
          chatContext: context(envelope),
        })
        const beforeDenial = fixtures.stats()
        const denied = await call(variant, '/chat', rejectedBody, {
          headers: elearningHeaders,
        })
        assert.equal(denied.status, 400)
        assert.equal(JSON.parse(denied.text).code, 'INVALID_CHAT_CONTEXT')
        assert.deepEqual(fixtures.stats(), beforeDenial)
        assert.equal(
          await prisma.chatMessage.count({
            where: {
              id: {
                in: [
                  rejectedBody.messages[0].id,
                  rejectedBody.assistantMessageId,
                ],
              },
            },
          }),
          0
        )
      }
      assert.deepEqual(await savedContext(originalId), originalSnapshot)
      variantChecks.push(
        'signed-elearning-tamper-expiry-and-foreign-learner-denied'
      )

      phase = `${variant}:saved-elearning-regeneration-and-edit`
      const liveBody = question(learningThread.id, {
        chatContext: context(liveEnvelope),
      })
      learningStats = fixtures.stats()
      const liveTurn = await verifyTurn(variant, liveBody, {
        headers: elearningHeaders,
      })
      const liveAssistantText = liveTurn.stored.content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
      assert(
        fixtures.stats().elearningLiveCalls > learningStats.elearningLiveCalls
      )
      assert.deepEqual(
        await savedContext(liveBody.messages[0].id),
        liveSnapshot
      )
      learningStats = fixtures.stats()
      await verifyTurn(
        variant,
        {
          ...originalBody,
          assistantMessageId: randomUUID(),
          allowRegeneration: true,
          chatContext: context(liveEnvelope),
        },
        { headers: elearningHeaders }
      )
      assert(
        fixtures.stats().elearningOriginalCalls >
          learningStats.elearningOriginalCalls
      )
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      assert.deepEqual(await savedContext(originalId), originalSnapshot)
      const editedBody = question(learningThread.id, {
        sourceMessageId: originalId,
        chatContext: context(liveEnvelope),
      })
      editedBody.messages[0].content = 'Synthetic edited question.'
      learningStats = fixtures.stats()
      await verifyTurn(variant, editedBody, { headers: elearningHeaders })
      assert(
        fixtures.stats().elearningOriginalCalls >
          learningStats.elearningOriginalCalls
      )
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      assert.deepEqual(
        await savedContext(editedBody.messages[0].id),
        originalSnapshot
      )
      assert.deepEqual(await savedContext(originalId), originalSnapshot)
      const invalidEdit = question(learningThread.id, {
        sourceMessageId: randomUUID(),
        chatContext: context(liveEnvelope),
      })
      learningStats = fixtures.stats()
      assert.equal(
        (
          await call(variant, '/chat', invalidEdit, {
            headers: elearningHeaders,
          })
        ).status,
        400
      )
      assert.deepEqual(fixtures.stats(), learningStats)
      assert.equal(
        await prisma.chatMessage.count({
          where: {
            id: {
              in: [invalidEdit.messages[0].id, invalidEdit.assistantMessageId],
            },
          },
        }),
        0
      )
      variantChecks.push(
        'saved-elearning-snapshot-preserved-on-regeneration-and-edit'
      )

      phase = `${variant}:saved-null-regeneration-and-edit`
      const nullBody = question(learningThread.id)
      nullBody.parentId = liveBody.assistantMessageId
      nullBody.messages = [
        liveBody.messages[0],
        {
          id: liveBody.assistantMessageId,
          role: 'assistant',
          content: liveAssistantText,
        },
        nullBody.messages[0],
      ]
      learningStats = fixtures.stats()
      await verifyTurn(variant, nullBody, { headers: elearningHeaders })
      assert(fixtures.stats().modelCalls > learningStats.modelCalls)
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      const nullId = nullBody.messages.at(-1).id
      assert.equal(await savedContext(nullId), null)
      learningStats = fixtures.stats()
      await verifyTurn(
        variant,
        {
          ...nullBody,
          assistantMessageId: randomUUID(),
          allowRegeneration: true,
          chatContext: context(liveEnvelope),
        },
        { headers: elearningHeaders }
      )
      assert(fixtures.stats().modelCalls > learningStats.modelCalls)
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      assert.equal(await savedContext(nullId), null)
      const editedNullBody = question(learningThread.id, {
        sourceMessageId: nullId,
        chatContext: context(liveEnvelope),
        parentId: liveBody.assistantMessageId,
      })
      editedNullBody.messages[0].content =
        'Synthetic edited question without saved evidence.'
      editedNullBody.messages = [
        liveBody.messages[0],
        {
          id: liveBody.assistantMessageId,
          role: 'assistant',
          content: liveAssistantText,
        },
        editedNullBody.messages[0],
      ]
      learningStats = fixtures.stats()
      await verifyTurn(variant, editedNullBody, { headers: elearningHeaders })
      assert(fixtures.stats().modelCalls > learningStats.modelCalls)
      assert.equal(
        fixtures.stats().elearningLiveCalls,
        learningStats.elearningLiveCalls
      )
      assert.equal(await savedContext(editedNullBody.messages.at(-1).id), null)
      assert.equal(await savedContext(nullId), null)
      assert.deepEqual(await savedContext(originalId), originalSnapshot)
      const learningHistory = await call(
        variant,
        `/threads/${learningThread.id}/messages`,
        undefined,
        { headers: elearningHeaders }
      )
      assert.equal(learningHistory.status, 200)
      const learningRows = JSON.parse(learningHistory.text)
      assert.deepEqual(
        learningRows.find((item) => item.id === originalId)?.learningContext,
        originalSnapshot
      )
      assert.equal(
        learningRows.find((item) => item.id === nullId)?.learningContext,
        null
      )
      variantChecks.push('saved-null-preserved-on-regeneration-and-edit')
      phase = `${variant}:images-and-documents`
      fixtures.setScenario('plain')
      const sharp = createRequire(join(root, 'apps/chat-api/package.json'))(
        'sharp'
      )
      const png = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#112233' },
      })
        .png()
        .toBuffer()
      const jpeg = await sharp(png).jpeg().toBuffer()
      const images = Array.from(
        { length: 3 },
        () => `data:image/png;base64,${png.toString('base64')}`
      )
      const documentPages = Array.from(
        { length: 10 },
        () => `data:image/jpeg;base64,${jpeg.toString('base64')}`
      )
      const { buildDocumentBlock } = await import(
        '../apps/chat-api/dist/host/lib/attachments/documentText.js'
      )
      const documentText = Array.from({ length: 3 }, (_, index) =>
        buildDocumentBlock({
          name: `synthetic-${index}.pdf`,
          text: `synthetic-document-marker ${index}\n${'x'.repeat(90000)}\nsynthetic-document-end-${index}`,
          pages: 10,
          shortened: false,
          visualReview: 'reviewed',
        })
      ).join('\n\n')
      const mixed = question((await thread()).id, { images, documentPages })
      mixed.messages[0].content = documentText + '\nWhat is visible?'
      const mixedResult = await verifyTurn(variant, mixed)
      assert.equal(fixtures.stats().replyImages, 13)
      assert(fixtures.stats().documentObserved)
      const attachments = await prisma.chatAttachment.findMany({
        where: { messageId: mixed.messages[0].id },
      })
      assert.equal(
        attachments.filter((attachment) => attachment.imageBase64).length,
        3
      )
      assert(
        attachments.every(
          (attachment) => !documentPages.includes(attachment.imageBase64)
        )
      )
      assert(
        !JSON.stringify(mixedResult.stored.content).includes(documentPages[0])
      )
      const followup = question(mixed.threadId, {
        parentId: mixed.assistantMessageId,
        messages: [
          mixed.messages[0],
          {
            id: mixed.assistantMessageId,
            role: 'assistant',
            content: fixtures.answer,
          },
          {
            id: randomUUID(),
            role: 'user',
            content: 'synthetic follow-up about the images.',
          },
        ],
      })
      await verifyTurn(variant, followup)
      if (variant === 'legacy')
        assert(fixtures.stats().imageDescriptionsObserved)
      else assert.equal(fixtures.stats().lastReplyImages, 3)
      variantChecks.push(
        'three-originals-ten-visual-pages-full-text-and-image-followup'
      )
      phase = `${variant}:history-window`
      const longThread = await thread()
      let historyParent = null
      const longHistory = Array.from({ length: 100 }, (_, index) => {
        const messageId = randomUUID()
        const row = {
          id: messageId,
          threadId: longThread.id,
          parentId: historyParent,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: [
            { type: 'text', text: `synthetic-history-marker ${index}` },
          ],
          lifecycleStatus: 'COMPLETED',
          createdAt: new Date(Date.now() - (100 - index) * 1000),
        }
        historyParent = messageId
        return row
      })
      await prisma.chatMessage.createMany({ data: longHistory })
      const longBody = question(longThread.id, {
        parentId: historyParent,
        messages: [
          ...longHistory.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content[0].text,
          })),
          {
            id: randomUUID(),
            role: 'user',
            content: 'synthetic recent question.',
          },
        ],
      })
      const longResult = await verifyTurn(variant, longBody)
      if (variant !== 'legacy')
        assert(
          longResult.events.some(
            (event) => event.messageMetadata?.contextOmittedMessages > 0
          )
        )
      assert.equal(
        await prisma.chatMessage.count({ where: { threadId: longThread.id } }),
        102
      )
      const savedLong = await call(
        variant,
        `/threads/${longThread.id}/messages`
      )
      assert.equal(JSON.parse(savedLong.text).length, 102)
      variantChecks.push('101-entry-reply-keeps-complete-saved-history')
      phase = `${variant}:attachment-and-token-limits`
      for (const extra of [
        { images: [...images, images[0]] },
        { documentPages: [...documentPages, documentPages[0]] },
      ]) {
        const before = fixtures.stats()
        const denied = await call(
          variant,
          '/chat',
          question((await thread()).id, extra)
        )
        assert.equal(denied.status, 400)
        assert.equal(fixtures.stats().modelCalls, before.modelCalls)
        assert.equal(fixtures.stats().practiceStarts, before.practiceStarts)
      }
      const overBudget = question((await thread()).id)
      overBudget.messages[0].content = 'x'.repeat(600000)
      if (variant === 'legacy') await verifyTurn(variant, overBudget)
      else {
        const before = fixtures.stats()
        const denied = await call(variant, '/chat', overBudget)
        assert.equal(denied.status, 400)
        assert.equal(JSON.parse(denied.text).code, 'CONTEXT_LIMIT_EXCEEDED')
        assert.equal(fixtures.stats().modelCalls, before.modelCalls)
        assert.equal(
          await prisma.chatMessage.count({
            where: { threadId: overBudget.threadId, role: 'user' },
          }),
          0
        )
        const rejected = await prisma.chatMessage.findUniqueOrThrow({
          where: { id: overBudget.assistantMessageId },
        })
        assert.equal(rejected.lifecycleStatus, 'FAILED')
        assert.equal(Number(rejected.creditsUsed ?? 0), 0)
      }
      variantChecks.push(
        'attachment-limits-and-explicit-api-token-budget-denial'
      )
      phase = `${variant}:completed-step-stop`
      fixtures.setScenario('calculator')
      fixtures.setBehavior('cancel')
      const stopBody = question((await thread()).id)
      const beforeStop = fixtures.stats()
      const usageKey = {
        ownerId: id.owner,
        usageClass: 'BASE',
        monthStart: getZurichMonthStart(new Date()),
      }
      const beforeUsage = await prisma.chatAccountUsage.findUniqueOrThrow({
        where: { ownerId_usageClass_monthStart: usageKey },
      })
      const controller = new AbortController()
      const stopResponse = await fetch(
        `http://127.0.0.1:${variant === 'legacy' ? 3004 : 3005}/api/chatbots/${id.bot}/chat`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(stopBody),
          signal: AbortSignal.any([
            controller.signal,
            shutdown.signal,
            AbortSignal.timeout(30000),
          ]),
        }
      )
      assert.equal(stopResponse.status, 200)
      const reader = stopResponse.body.getReader()
      const decoder = new TextDecoder()
      let buffered = '',
        toolFinished = false,
        stepFinished = false
      while (!toolFinished || !stepFinished) {
        const part = await reader.read()
        assert(!part.done, 'Stop scenario ended before the completed tool step')
        buffered += decoder.decode(part.value, { stream: true })
        const lines = buffered.split('\n')
        buffered = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          const event = JSON.parse(line.slice(6))
          toolFinished ||= event.type === 'tool-output-available'
          stepFinished ||=
            event.type === 'finish-step' ||
            (event.type === 'message-metadata' &&
              event.messageMetadata?.usage?.totalTokens > 0)
          assert.notEqual(event.type, 'error')
        }
      }
      await waitFor(
        () => fixtures.stats().modelCalls >= beforeStop.modelCalls + 2,
        15000
      )
      controller.abort()
      await reader.cancel().catch(() => undefined)
      let stopped
      await waitFor(async () => {
        stopped = await prisma.chatMessage.findUnique({
          where: { id: stopBody.assistantMessageId },
        })
        return stopped?.lifecycleStatus === 'COMPLETED'
      }, 15000)
      assert(
        stopped.content.some(
          (part) => part.type === 'data' && part.name === 'chat-stopped'
        )
      )
      assert(stopped.creditsUsed.toNumber() > 0)
      const afterUsage = await prisma.chatAccountUsage.findUniqueOrThrow({
        where: { ownerId_usageClass_monthStart: usageKey },
      })
      assert(
        afterUsage.usedCredits
          .sub(beforeUsage.usedCredits)
          .eq(stopped.creditsUsed)
      )
      await waitFor(
        () => fixtures.stats().cancelledCalls > beforeStop.cancelledCalls,
        10000
      )
      fixtures.setBehavior('success')
      fixtures.setScenario('plain')
      await verifyTurn(variant, {
        ...stopBody,
        assistantMessageId: randomUUID(),
        allowRegeneration: true,
      })
      assert.equal(
        fixtures.stats().calculatorResults,
        beforeStop.calculatorResults + 1
      )
      variantChecks.push('stop-later-model-retains-one-known-charge-and-retry')
      phase = `${variant}:browser-preparation`
      const browserThread = await thread()
      let parentId = null
      const rows = Array.from({ length: 100 }, (_, index) => {
        const messageId = randomUUID()
        const row = {
          id: messageId,
          threadId: browserThread.id,
          parentId,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: [
            { type: 'text', text: `synthetic-history-marker ${index}` },
          ],
          lifecycleStatus: 'COMPLETED',
          createdAt: new Date(Date.now() - (100 - index) * 1000),
        }
        parentId = messageId
        return row
      })
      await prisma.chatMessage.createMany({ data: rows })
      fixtures.setScenario('calculator')
      if (setup.browser) {
        receipt(`browser-ready-${variant}.json`, {
          generation: setup.generation,
          variant,
          chatbotId: id.bot,
          threadId: browserThread.id,
          participantId: id.participant,
          practiceThreadId: practiceBody.threadId,
          graphKbId: id.kb,
          authState: 'browser-auth-state.json',
          chatOrigin: setup.chatOrigin,
          apiOrigin: setup.apiOrigin,
        })
        await waitFor(
          () => existsSync(join(directory, `browser-result-${variant}.json`)),
          600000
        )
        const result = readReceipt(`browser-result-${variant}.json`)
        assert.equal(result.generation, setup.generation)
        assert.equal(result.status, 'passed')
        variantChecks.push('manual-browser-result-verified')
      }
      assert.equal(fixtures.stats().violations, 0)
      checks.push({ variant, checks: variantChecks, stats: fixtures.stats() })
      receipt(`acceptance-${variant}.json`, {
        status: 'passed',
        generation: setup.generation,
        variant,
        checks: variantChecks,
        stats: fixtures.stats(),
      })
    }
    receipt('acceptance.json', {
      status: 'passed',
      generation: setup.generation,
      checks,
      requests,
      limitations: [
        'deterministic synthetic provider/tool transports',
        'signed launch browser acceptance remains a separate required portfolio row',
        'signed eLearning browser launch and preference coverage remain separate required portfolio rows',
      ],
    })
  } catch (error) {
    receipt('acceptance.json', {
      status: 'failed',
      generation: setup.generation,
      phase,
      checks,
      error:
        error.name === 'AssertionError'
          ? 'assertion-failed'
          : 'qualification-failed',
      detail:
        error.name === 'AssertionError'
          ? String(error.message).slice(0, 240)
          : undefined,
      stats: fixtures?.stats(),
    })
    throw new Error('Local qualification failed; inspect the private receipt')
  } finally {
    let stopped = true
    for (const child of [...children].reverse()) {
      try {
        await stopChild(child)
      } catch {
        stopped = false
      }
    }
    if (fixtures) await fixtures.close()
    if (graph && stopped) await graph.delete()
    if (graphClient) await graphClient.close()
    if (owned && stopped) {
      await requireDisposableDatabase(prisma)
      await prisma.participant.deleteMany({
        where: { id: id.participant, username: tag },
      })
      await prisma.user.deleteMany({
        where: {
          id: id.owner,
          shortname: tag,
          email: `${tag}@example.invalid`,
        },
      })
      await prisma.chatbotMCPServer.deleteMany({
        where: { id: id.server, name: mcpName },
      })
    }
    await prisma.$disconnect()
    receipt('worker-cleanup.json', {
      childrenStopped: stopped,
      fixturesStopped: true,
      ownedRowsCleaned: owned && stopped,
    })
  }
}

async function host() {
  const [publicId, privateId, privateSourceArg, revision] = process.argv.slice(
    4,
    8
  )
  assert(
    /^[a-f0-9]{64}$/.test(publicId ?? '') &&
      /^[a-f0-9]{64}$/.test(privateId ?? '')
  )
  assert(/^[a-f0-9]{40}$/.test(revision ?? ''))
  const privateSource = realpathSync(privateSourceArg)
  const run = (command, args) => {
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    })
    assert.equal(result.status, 0, `Qualification ${command} failed`)
    return result.stdout.trim()
  }
  const inspect = (id, source, destination) => {
    const value = JSON.parse(
      run('docker', ['inspect', '--format', '{{json .}}', id])
    )
    assert(value.State.Running)
    assert(
      value.Mounts.some(
        (mount) =>
          mount.Type === 'bind' &&
          mount.Source === source &&
          mount.Destination === destination
      )
    )
    return value
  }
  const publicState = inspect(publicId, root, '/workspaces/klicker-uzh')
  const privateState = inspect(privateId, privateSource, '/workspaces/catalyst')
  const graphIndex = process.argv.indexOf('--graph-container')
  const graphId = graphIndex >= 0 ? process.argv[graphIndex + 1] : undefined
  assert(
    /^[a-f0-9]{64}$/.test(graphId ?? ''),
    'Pass the exact owned graph container'
  )
  const graphState = JSON.parse(
    run('docker', ['inspect', '--format', '{{json .}}', graphId])
  )
  assert(graphState.State.Running)
  assert.equal(graphState.Config.Labels['codex.source'], root)
  assert.equal(
    graphState.Config.Labels['codex.task'],
    privateState.Config.Labels['codex.task']
  )
  const graphHost = graphState.Name.slice(1)
  assert(
    /^[a-z0-9-]+$/.test(graphHost) && graphState.NetworkSettings.Networks.devnet
  )
  assert(
    privateState.Config.Labels['codex.task'],
    'The private container needs an explicit task owner'
  )
  assert.equal(run('git', ['-C', privateSource, 'rev-parse', 'HEAD']), revision)
  run('git', [
    '-C',
    privateSource,
    'diff',
    '--exit-code',
    revision,
    '--',
    'apps/tutoring-engine',
  ])
  const alias = publicState.NetworkSettings.Networks.devnet?.Aliases?.find(
    (value) => value.endsWith('-app') && value !== 'app'
  )
  assert(alias, 'The owned public runtime needs its managed devnet alias')
  const privateHost = privateState.Name.slice(1)
  assert(/^[a-z0-9-]+$/.test(privateHost))
  const relativeDirectory = relative(root, directory)
  mkdirSync(directory, { recursive: false })
  const generation = randomUUID()
  const setup = {
    generation,
    sourcePath: root,
    publicRevision: run('git', ['rev-parse', 'HEAD']),
    publicDiffSha256: createHash('sha256')
      .update(run('git', ['diff', 'HEAD']))
      .digest('hex'),
    privateRevision: revision,
    graphContainer: graphId,
    graphImage: graphState.Image,
    graphHost,
    containerSourcePath: '/workspaces/klicker-uzh',
    fixtureHost: alias,
    engineUrl: `http://${privateHost}:3015`,
    chatOrigin: 'http://127.0.0.1:13104',
    apiOrigin: 'http://127.0.0.1:13105',
    browser: process.argv.includes('--browser'),
  }
  receipt('setup.json', setup)
  let workerProcess, engineProcess
  let attached = false
  const enginePidPath = `/tmp/chat-qualification-${generation}.json`
  try {
    if (!privateState.NetworkSettings.Networks.devnet) {
      run('docker', [
        'network',
        'connect',
        '--alias',
        privateHost,
        'devnet',
        privateId,
      ])
      attached = true
    }
    workerProcess = spawn(
      'devsy',
      [
        'workspace',
        'exec',
        '--container-id',
        publicId,
        '--workspace-folder',
        setup.containerSourcePath,
        '--',
        'env',
        'CHAT_API_QUALIFICATION=1',
        'node',
        'util/run-chat-api-qualification.mjs',
        '--worker',
        relativeDirectory,
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] }
    )
    await waitFor(() => {
      if (workerProcess.exitCode !== null)
        throw new Error('Owned worker exited before fixture readiness')
      return existsSync(join(directory, 'fixtures.json'))
    }, 60000)
    const fixture = readReceipt('fixtures.json')
    assert.equal(fixture.generation, generation)
    inspect(privateId, privateSource, '/workspaces/catalyst')
    const bootstrap = `require('node:fs').writeFileSync(${JSON.stringify(enginePidPath)},JSON.stringify({pid:process.pid,generation:${JSON.stringify(generation)}}));import('./apps/tutoring-engine/dist/server-runtime.js')`
    engineProcess = spawn(
      'docker',
      [
        'exec',
        '-w',
        '/workspaces/catalyst',
        ...Object.entries(fixture.engineEnvironment).flatMap(([key, value]) => [
          '--env',
          `${key}=${value}`,
        ]),
        privateId,
        'node',
        '-e',
        bootstrap,
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] }
    )
    const timeout = setTimeout(
      () => shutdown.abort(),
      setup.browser ? 2000000 : 300000
    )
    try {
      await Promise.race([
        once(workerProcess, 'exit'),
        new Promise((_, reject) =>
          shutdown.signal.addEventListener(
            'abort',
            () => reject(new Error('Qualification total deadline exceeded')),
            { once: true }
          )
        ),
      ])
      assert.equal(workerProcess.exitCode, 0, 'Qualification worker failed')
      assert.equal(readReceipt('acceptance.json').status, 'passed')
      assert.equal(readReceipt('worker-cleanup.json').childrenStopped, true)
      console.log(
        'Synthetic three-variant subset passed; inspect explicit remaining portfolio rows.'
      )
    } finally {
      clearTimeout(timeout)
    }
  } finally {
    if (
      workerProcess &&
      workerProcess.exitCode === null &&
      existsSync(join(directory, 'worker-owner.json'))
    ) {
      inspect(publicId, root, setup.containerSourcePath)
      const ownerPath = join(
        setup.containerSourcePath,
        relativeDirectory,
        'worker-owner.json'
      )
      const stop = `const fs=require('node:fs');const p=JSON.parse(fs.readFileSync(${JSON.stringify(ownerPath)},'utf8'));if(p.generation!==${JSON.stringify(generation)}||p.containerSourcePath!==${JSON.stringify(setup.containerSourcePath)})throw Error('Owner mismatch');try{const cmd=fs.readFileSync('/proc/'+p.pid+'/cmdline','utf8');if(!cmd.includes('util/run-chat-api-qualification.mjs')||!cmd.includes('--worker'))throw Error('Process incarnation mismatch');process.kill(p.pid,'SIGTERM')}catch(e){if(e.code!=='ENOENT'&&e.code!=='ESRCH')throw e}`
      run('devsy', [
        'workspace',
        'exec',
        '--container-id',
        publicId,
        '--workspace-folder',
        setup.containerSourcePath,
        '--',
        'node',
        '-e',
        stop,
      ])
      await Promise.race([
        once(workerProcess, 'exit'),
        delay(30000, undefined, { ref: false }).then(() => {
          throw new Error('Owned worker did not finish cleanup')
        }),
      ])
    }
    if (workerProcess) await stopChild(workerProcess)
    if (engineProcess) {
      inspect(privateId, privateSource, '/workspaces/catalyst')
      const stop = `const f=require('node:fs');const p=JSON.parse(f.readFileSync(${JSON.stringify(enginePidPath)},'utf8'));if(p.generation!==${JSON.stringify(generation)})throw Error('Owner mismatch');try{process.kill(p.pid,'SIGTERM')}catch(e){if(e.code!=='ESRCH')throw e}`
      run('docker', [
        'exec',
        '-w',
        '/workspaces/catalyst',
        privateId,
        'node',
        '-e',
        stop,
      ])
      await stopChild(engineProcess)
    }
    if (attached) run('docker', ['network', 'disconnect', 'devnet', privateId])
    receipt('host-cleanup.json', {
      generation,
      taskNetworkDetached: attached,
      engineStopped: engineProcess?.exitCode !== null,
      workerStopped: workerProcess?.exitCode !== null,
    })
  }
}

try {
  if (mode === '--worker') await worker()
  else if (mode === '--host') await host()
  else
    throw new Error(
      'Use --host <fresh-private-run-directory> <public-container-id> <private-container-id> <private-source> <private-revision> --graph-container <owned-id> [--browser]'
    )
} catch {
  console.error(
    'Qualification failed; inspect the private producing-run receipts.'
  )
  process.exitCode = 1
}
