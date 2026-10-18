import type { GetServerSidePropsContext } from 'next'

export default function getAssessmentRedirect(
  ctx: Pick<GetServerSidePropsContext, 'req' | 'resolvedUrl' | 'locale'>,
  assessmentOrigin = process.env.APP_ORIGIN_ASSESSMENT_PWA
) {
  if (!assessmentOrigin || !ctx.req.headers.host) return null

  const destination = new URL(assessmentOrigin)
  if (destination.host.toLowerCase() === ctx.req.headers.host.toLowerCase()) {
    return null
  }

  // resolvedUrl also contains the original query on Next.js data requests.
  // Assign the path separately so a request cannot replace the trusted origin.
  const queryIndex = ctx.resolvedUrl.indexOf('?')
  const pathname =
    queryIndex === -1 ? ctx.resolvedUrl : ctx.resolvedUrl.slice(0, queryIndex)
  const localePrefix = ctx.locale ? `/${ctx.locale}` : ''
  destination.pathname =
    pathname === localePrefix || pathname.startsWith(`${localePrefix}/`)
      ? pathname
      : `${localePrefix}${pathname}`
  destination.search =
    queryIndex === -1 ? '' : ctx.resolvedUrl.slice(queryIndex)
  destination.hash = ''

  return { destination: destination.toString(), permanent: false as const }
}
