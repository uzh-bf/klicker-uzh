import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { BookOpenText, LogOut, PanelTopOpen } from 'lucide-react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactNode, useEffect } from 'react'

interface KbLayoutProps {
  children: ReactNode
}

export function KbLayout({ children }: KbLayoutProps) {
  const router = useRouter()
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth.klicker.com'
  const manageUrl =
    process.env.NEXT_PUBLIC_MANAGE_URL ?? 'https://manage.klicker.com'
  const { loading, error, data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading && !data?.userProfile) {
      router.push(
        `/login?redirect_to=${encodeURIComponent(
          router.asPath && router.asPath !== '/login' ? router.asPath : '/'
        )}`
      )
    }
  }, [data?.userProfile, loading, router])

  if (loading && !data?.userProfile) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <Loader />
      </main>
    )
  }

  if (!data?.userProfile || error) {
    return (
      <main className="flex min-h-full items-center justify-center p-6">
        <UserNotification type="error">
          {error?.message || 'Authentication required.'}
        </UserNotification>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>Knowledge Bases | KlickerUZH</title>
        <meta
          name="description"
          content="Manage knowledge bases and resources for KlickerUZH."
        />
      </Head>

      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 text-sm shadow-sm">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center gap-2 font-bold text-slate-950"
        >
          <span className="bg-primary-100 flex size-7 items-center justify-center rounded text-white">
            <BookOpenText className="size-4" />
          </span>
          <span>KlickerUZH KB</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => window.location.assign(manageUrl)}
            className={{
              root: 'hidden h-8 gap-2 border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 sm:flex',
            }}
          >
            <PanelTopOpen className="size-4" />
            Manage
          </Button>

          <span className="hidden max-w-40 truncate text-slate-600 sm:inline">
            {data.userProfile.shortname}
          </span>

          <Button
            onClick={() => window.location.assign(`${authUrl}/logout`)}
            className={{
              root: 'h-8 gap-2 border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50',
            }}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        {children}
      </main>
    </>
  )
}
