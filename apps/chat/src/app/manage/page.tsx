import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ManageAssistant } from '../../components/manage-assistant'
import { isManageAiEnabled } from '../../lib/server/featureFlags'
import { getAuthenticatedManageUser } from '../../lib/server/manageAuth'

interface ManageAssistantPageProps {
  searchParams?: Promise<{ embed?: string | string[] }>
}

export default async function ManageAssistantPage({
  searchParams,
}: ManageAssistantPageProps) {
  const manageUser = await getAuthenticatedManageUser()

  // The gate is evaluated per lecturer, so it can only be evaluated once one
  // is signed in. A signed-out visitor keeps the login prompt rather than a
  // 404: it is a static page carrying no capability, and 404ing it would
  // strand an opted-in lecturer whose session expired.
  if (!manageUser) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const embedded = isEmbeddedParam(resolvedSearchParams.embed)

    return <ManageLoginRequired embedded={embedded} />
  }

  if (!(await isManageAiEnabled(manageUser))) {
    notFound()
  }

  return <ManageAssistant />
}

function isEmbeddedParam(embedParam?: string | string[]) {
  return (
    embedParam === 'true' ||
    embedParam === '1' ||
    (Array.isArray(embedParam) &&
      (embedParam[0] === 'true' || embedParam[0] === '1'))
  )
}

function ManageLoginRequired({ embedded }: { embedded: boolean }) {
  const manageBaseUrl = process.env.NEXT_PUBLIC_MANAGE_URL
    ? process.env.NEXT_PUBLIC_MANAGE_URL.replace(/\/$/, '')
    : 'https://manage.klicker.uzh.ch'

  return (
    <div className="bg-muted flex min-h-dvh w-full items-center justify-center px-4">
      <div
        className={
          embedded
            ? 'bg-card w-full max-w-sm rounded-md border p-4 text-center shadow-sm'
            : 'bg-card w-full max-w-lg rounded-md border p-8 text-center shadow-sm'
        }
      >
        <h1
          className={
            embedded
              ? 'text-foreground text-lg font-semibold'
              : 'text-foreground text-2xl font-semibold'
          }
        >
          Login Required
        </h1>
        <p
          className={
            embedded
              ? 'text-muted-foreground mt-2 text-sm'
              : 'text-muted-foreground mt-4 text-base'
          }
        >
          Sign in to KlickerUZH Manage to use the lecturer assistant.
        </p>
        {!embedded && (
          <Link
            href={`${manageBaseUrl}/login`}
            className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            prefetch={false}
          >
            Go to KlickerUZH Manage
          </Link>
        )}
      </div>
    </div>
  )
}
