// Minimal LTI 1.3 platform for exercising the real LTI service (apps/lti,
// ltijs) locally. It implements only the resource-link launch: login
// initiation, the OIDC authorization response as an auto-submitted form POST,
// and the key set ltijs uses to verify the id_token.
//
// The platform registration it must match lives in .devcontainer/devcontainer.env
// (LTI_URL, LTI_CLIENT_ID, LTI_AUTH_ENDPOINT, LTI_KEYS_ENDPOINT). Run it
// standalone for manual launches with:
//   node playwright/lti-harness/mockPlatform.ts
// (Node 24 strips the TypeScript annotations.)

import {
  createSign,
  generateKeyPairSync,
  type KeyObject,
  randomUUID,
} from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { pathToFileURL } from 'node:url'

export const MOCK_PLATFORM_PORT = 4311
export const MOCK_PLATFORM_CLIENT_ID = 'klicker-lti-harness'
export const MOCK_PLATFORM_DEPLOYMENT_ID = 'klicker-lti-harness-deployment'

const LTI_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim'
const LEARNER_ROLE = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'

export type LaunchEmbedding = 'top-level' | 'iframe'

// How the launch names its target: the klicker_redirect_to custom claim, or a
// redirectTo query parameter on the tool's target link URI.
export type LaunchTargetRoute = 'custom' | 'query'

export type MockPlatformOptions = {
  // Tool origin, e.g. https://lti.klicker.localhost
  toolOrigin: string
  // Absolute HTTPS URL the tool redirects to after a successful launch
  redirectTarget: string
  port?: number
  // sandbox attribute for the iframe launch, to reproduce an LMS that sets one
  iframeSandbox?: string
}

export type MockPlatform = {
  origin: string
  launchUrl: (embedding: LaunchEmbedding, route?: LaunchTargetRoute) => string
  close: () => Promise<void>
}

export async function startMockPlatform({
  toolOrigin,
  redirectTarget,
  port = MOCK_PLATFORM_PORT,
  iframeSandbox,
}: MockPlatformOptions): Promise<MockPlatform> {
  // The issuer must equal LTI_URL in the tool's platform registration.
  const origin = `http://127.0.0.1:${port}`
  const kid = randomUUID()
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  const tool = new URL(toolOrigin)
  // The launch URI platforms register; a target link URI may add a query.
  const launchUri = new URL('/', tool).toString()
  const targetLinkUri = (route: LaunchTargetRoute) =>
    route === 'query'
      ? `${launchUri}?${new URLSearchParams({ redirectTo: redirectTarget })}`
      : launchUri

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error('[lti-mock-platform]', error)
      send(res, 500, 'text/plain', 'mock platform error')
    })
  })

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', origin)

    if (url.pathname === '/jwks') {
      const jwk = publicKey.export({ format: 'jwk' })
      return send(
        res,
        200,
        'application/json',
        JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] })
      )
    }

    // Parent page standing in for the LMS course page.
    if (url.pathname === '/launch') {
      const embedding = url.searchParams.get('embedding')
      const start = `/start?${new URLSearchParams({
        route: url.searchParams.get('route') ?? 'custom',
      })}`
      if (embedding === 'top-level') {
        res.writeHead(302, { Location: start })
        return res.end()
      }
      return send(
        res,
        200,
        'text/html; charset=utf-8',
        `<!doctype html><title>Mock LMS</title>
<iframe name="tool" src="${escapeHtml(start)}" style="width:100%;height:90vh;border:0"
  allow="clipboard-write; fullscreen"${
    iframeSandbox === undefined ? '' : ` sandbox="${escapeHtml(iframeSandbox)}"`
  }></iframe>`
      )
    }

    // Third-party initiated login, sent as a form POST like common LMSs do.
    if (url.pathname === '/start') {
      const route =
        url.searchParams.get('route') === 'query' ? 'query' : 'custom'
      return sendAutoPost(res, new URL('/login', tool).toString(), {
        iss: origin,
        login_hint: 'lti-harness-learner',
        // the tool passes this hint back unchanged to /auth
        lti_message_hint: route,
        target_link_uri: targetLinkUri(route),
        client_id: MOCK_PLATFORM_CLIENT_ID,
        lti_deployment_id: MOCK_PLATFORM_DEPLOYMENT_ID,
      })
    }

    // OIDC authorization endpoint: answers with a signed id_token.
    if (url.pathname === '/auth') {
      const params = url.searchParams
      // Platforms accept only the registered redirect URI: the target link
      // URI without its query.
      const redirectUri = params.get('redirect_uri') ?? ''
      if (
        params.get('client_id') !== MOCK_PLATFORM_CLIENT_ID ||
        redirectUri !== launchUri
      ) {
        return send(res, 400, 'text/plain', 'invalid authorization request')
      }

      const route =
        params.get('lti_message_hint') === 'query' ? 'query' : 'custom'
      const now = Math.floor(Date.now() / 1000)
      const idToken = signJwt(privateKey, kid, {
        iss: origin,
        aud: MOCK_PLATFORM_CLIENT_ID,
        sub: 'lti-harness-learner',
        // A seeded participant: the first launch links this LTI identity to
        // it by email, so the PWA can sign the learner in.
        email: 'testuser50@test.uzh.ch',
        name: 'LTI Harness Learner',
        nonce: params.get('nonce'),
        iat: now,
        exp: now + 300,
        [`${LTI_CLAIM}/message_type`]: 'LtiResourceLinkRequest',
        [`${LTI_CLAIM}/version`]: '1.3.0',
        [`${LTI_CLAIM}/deployment_id`]: MOCK_PLATFORM_DEPLOYMENT_ID,
        [`${LTI_CLAIM}/target_link_uri`]: targetLinkUri(route),
        [`${LTI_CLAIM}/resource_link`]: { id: 'lti-harness-resource' },
        [`${LTI_CLAIM}/context`]: { id: 'lti-harness-context' },
        [`${LTI_CLAIM}/roles`]: [LEARNER_ROLE],
        ...(route === 'custom' && {
          [`${LTI_CLAIM}/custom`]: { klicker_redirect_to: redirectTarget },
        }),
      })

      return sendAutoPost(res, redirectUri, {
        id_token: idToken,
        state: params.get('state') ?? '',
      })
    }

    send(res, 404, 'text/plain', 'not found')
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })

  return {
    origin,
    launchUrl: (embedding, route = 'custom') =>
      `${origin}/launch?${new URLSearchParams({ embedding, route })}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  }
}

function signJwt(
  privateKey: KeyObject,
  kid: string,
  payload: Record<string, unknown>
) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const signingInput = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode(payload)}`
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey)
    .toString('base64url')
  return `${signingInput}.${signature}`
}

function sendAutoPost(
  res: ServerResponse,
  action: string,
  fields: Record<string, string>
) {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`
    )
    .join('')
  send(
    res,
    200,
    'text/html; charset=utf-8',
    `<!doctype html><title>Mock LMS</title>
<form method="post" action="${escapeHtml(action)}">${inputs}</form>
<script>document.forms[0].submit()</script>`
  )
}

function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string
) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  })
  res.end(body)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const toolOrigin =
    process.env.LTI_HARNESS_TOOL_ORIGIN ?? 'https://lti.klicker.localhost'
  // The seeded Testkurs (COURSE_ID_TEST in prisma-data). Plain node cannot
  // load that constants module, so the manual run repeats its id.
  const redirectTarget =
    process.env.LTI_HARNESS_REDIRECT_TARGET ??
    'https://pwa.klicker.localhost/course/7c12e44e-d083-4acf-845e-4c34aaff6b49'
  const platform = await startMockPlatform({
    toolOrigin,
    redirectTarget,
    iframeSandbox: process.env.LTI_HARNESS_IFRAME_SANDBOX,
  })
  console.log(`[lti-mock-platform] tool: ${toolOrigin}`)
  console.log(
    `[lti-mock-platform] iframe launch: ${platform.launchUrl('iframe')}`
  )
  console.log(
    `[lti-mock-platform] top-level launch: ${platform.launchUrl('top-level')}`
  )
}
