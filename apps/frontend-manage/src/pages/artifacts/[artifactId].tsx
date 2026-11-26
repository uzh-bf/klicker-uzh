import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { StaffActivityArtifactDocument } from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import { H3, UserNotification } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'

/**
 * Fixed Manage landing page for a canonical publisher link.
 *
 * The publisher redirects `https://{publisher origin}/a/{uuid}` here for an
 * authenticated open. The staff lookup resolves the latest revision through
 * the backend with the linked lecturer subject and renders it only in the
 * isolated trusted frame.
 */
function ArtifactLandingPage() {
  const router = useRouter()
  const enabled = useFeatureFlag('activity-artifacts')
  const artifactId =
    typeof router.query.artifactId === 'string'
      ? router.query.artifactId
      : undefined

  const { data, loading } = useQuery(StaffActivityArtifactDocument, {
    variables: { artifactId: artifactId ?? '' },
    skip: !enabled || !artifactId,
    fetchPolicy: 'network-only',
  })
  const artifact = data?.staffActivityArtifact

  if (!enabled) {
    return (
      <Layout displayName="Activity artifact">
        <div className="mx-auto w-full max-w-4xl p-4">
          <UserNotification type="error">
            This artifact could not be opened.
          </UserNotification>
        </div>
      </Layout>
    )
  }

  return (
    <Layout displayName={artifact?.title ?? 'Activity artifact'}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
        <H3>Activity artifact</H3>

        {loading ? <div className="text-sm">Resolving artifact…</div> : null}

        {!loading && !artifact ? (
          <UserNotification type="error">
            This artifact could not be opened. Sign in with a linked lecturer
            account and check that the artifact exists.
          </UserNotification>
        ) : null}

        {artifact ? (
          <>
            <div className="text-sm text-slate-600">
              {artifact.title} · revision v{artifact.version} · digest{' '}
              {artifact.digest.slice(0, 12)}…
            </div>
            <ActivityArtifactFrame
              frameUrl={artifact.frameUrl}
              canonicalUrl={artifact.url}
              title={artifact.title}
              exercise={artifact.exercise}
              className="h-[420px] w-full rounded border border-slate-300"
            />
            <div className="text-xs text-slate-500">{artifact.url}</div>
          </>
        ) : null}
      </div>
    </Layout>
  )
}

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default ArtifactLandingPage
