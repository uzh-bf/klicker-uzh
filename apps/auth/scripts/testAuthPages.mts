import assert from 'node:assert/strict'
import test from 'node:test'

// Run against a built auth app configured with the supplied synthetic origins.
// HTTP responses exercise the compiled proxy and the server-rendered page
// together, including the state presented before JavaScript hydrates.
const authOrigin = process.env.AUTH_TEST_ORIGIN
const assessmentOrigin = process.env.AUTH_TEST_ASSESSMENT_ORIGIN
const manageOrigin = process.env.AUTH_TEST_MANAGE_ORIGIN
assert.ok(authOrigin && assessmentOrigin && manageOrigin)

async function page(path: string) {
  const response = await fetch(new URL(path, authOrigin), {
    redirect: 'manual',
  })
  return { status: response.status, html: await response.text() }
}

test('compiled auth accepts the configured manage transport and return path', async () => {
  const target = `${manageOrigin}/resources/answerCollections?tab=shared`
  const response = await page(`/?redirectTo=${encodeURIComponent(target)}`)
  assert.equal(response.status, 200)
})

test('student page preserves a configured assessment deep link on the server', async () => {
  const target = `${assessmentOrigin}/course/synthetic-course?assessment=synthetic`
  const response = await page(
    `/student?redirectTo=${encodeURIComponent(target)}`
  )
  assert.equal(response.status, 200)
  const data = response.html.match(
    /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s
  )
  assert.ok(data?.[1], 'server page data must be present')
  assert.equal(JSON.parse(data[1]).props.pageProps.redirectTo, target)
})

test('participant recovery never serves a lecturer choice before hydration', async () => {
  for (const locale of ['', '/de']) {
    const response = await page(
      `${locale}/restart?audience=participant&error=access_denied`
    )
    assert.equal(response.status, 200)
    assert.ok(response.html.includes('data-cy="restart-student-login-button"'))
    assert.ok(
      !response.html.includes('data-cy="restart-lecturer-login-button"')
    )
  }
})

test('unknown recovery keeps explicit audience choices', async () => {
  const response = await page('/restart')
  assert.equal(response.status, 200)
  assert.ok(response.html.includes('data-cy="restart-student-login-button"'))
  assert.ok(response.html.includes('data-cy="restart-lecturer-login-button"'))
})

test('HTTPS deployments reject HTTP return targets', {
  skip: process.env.AUTH_TEST_REQUIRE_HTTPS !== 'true',
}, async () => {
  for (const [route, origin] of [
    ['/', manageOrigin],
    ['/student', assessmentOrigin],
  ]) {
    const target = new URL('/course/synthetic', origin)
    target.protocol = 'http:'
    const response = await page(
      `${route}?redirectTo=${encodeURIComponent(target.href)}`
    )
    assert.equal(response.status, 400)
  }
})
