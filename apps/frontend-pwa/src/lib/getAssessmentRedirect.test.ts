import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { GetServerSidePropsContext } from 'next'
import getAssessmentRedirect from './getAssessmentRedirect'

const origin = 'https://assessment.example.org'
function context(resolvedUrl: string, locale: string | undefined = 'de') {
  return {
    resolvedUrl,
    locale,
    req: { headers: { host: 'pwa.example.org' } },
  } as Pick<GetServerSidePropsContext, 'req' | 'resolvedUrl' | 'locale'>
}

describe('assessment redirect', () => {
  it('preserves course routes, locale and encoded/repeated query parameters', () => {
    assert.deepEqual(
      getAssessmentRedirect(
        context('/course/test/liveQuizzes/overview?jwt=a%2Bb&tag=1&tag=2'),
        origin
      ),
      {
        destination: `${origin}/de/course/test/liveQuizzes/overview?jwt=a%2Bb&tag=1&tag=2`,
        permanent: false,
      }
    )
  })

  it('does not duplicate a locale already present in the resolved URL', () => {
    assert.equal(
      getAssessmentRedirect(context('/en/session/test?x=1', 'en'), origin)
        ?.destination,
      `${origin}/en/session/test?x=1`
    )
  })

  it('supports routes without a locale', () => {
    const ctx = context('/session/test')
    ctx.locale = undefined
    assert.equal(
      getAssessmentRedirect(ctx, origin)?.destination,
      `${origin}/session/test`
    )
  })

  it('does not redirect when already on the assessment host', () => {
    const ctx = context('/course/test')
    ctx.req.headers.host = 'ASSESSMENT.example.org'
    assert.equal(getAssessmentRedirect(ctx, origin), null)
  })

  it('compares complete hosts including ports rather than substrings', () => {
    const ctx = context('/session/test')
    ctx.req.headers.host = 'example.org'
    assert.ok(getAssessmentRedirect(ctx, origin))
    ctx.req.headers.host = 'localhost:3001'
    assert.ok(getAssessmentRedirect(ctx, 'http://localhost:3002'))
    assert.equal(getAssessmentRedirect(ctx, 'http://localhost:3001'), null)
  })

  it('does not redirect without an origin or request host', () => {
    const ctx = context('/course/test')
    assert.equal(getAssessmentRedirect(ctx, ''), null)
    delete ctx.req.headers.host
    assert.equal(getAssessmentRedirect(ctx, origin), null)
  })

  it('keeps the configured origin for a protocol-relative request path', () => {
    const redirect = getAssessmentRedirect(
      context('//other.example/path'),
      origin
    )
    assert.equal(new URL(redirect!.destination).origin, origin)
  })
})
