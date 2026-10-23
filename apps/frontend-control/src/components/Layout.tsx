import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import Header from './layout/Header'
import MobileMenuBar from './layout/MobileMenuBar'
import PageContainer from './layout/PageContainer'

interface LayoutProps {
  title: string
  children: React.ReactNode
  className?: string
  // redesigned screens pass their own sticky header; this replaces the dark
  // title bar and the mobile menu bar of the original layout
  header?: React.ReactNode
}

function Layout({ title, children, className, header }: LayoutProps) {
  const router = useRouter()
  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument)

  if ((!dataUser && !loadingUser) || errorUser) {
    router.push('/login')
  }
  if (!dataUser) {
    return <Loader />
  }

  const head = (
    <Head>
      <title>{`KlickerUZH Controller ${title}`}</title>
      <meta
        name="description"
        content="KlickerUZH Controller App"
        charSet="utf-8"
      ></meta>
    </Head>
  )

  if (header) {
    return (
      <div className="bg-ctrl-bg flex h-full w-full flex-col font-sans">
        {head}
        <div className="flex-1 overflow-y-auto">
          {header}
          <PageContainer
            className={twMerge(
              'animate-ctrl-screen-in relative pt-4 pb-6',
              className
            )}
          >
            {children}
          </PageContainer>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {head}

      <div className={twMerge('overflow-y-none h-full', className)}>
        <div className="fixed top-0 z-10 w-full">
          <Header title={title} />
        </div>

        <div className="mb-12 mt-11 flex h-[calc(100%-5.75rem)] flex-col overflow-y-auto p-4 md:mb-0 md:h-[calc(100%-2.75rem)]">
          {children}
        </div>

        <div className="fixed bottom-0 h-12 w-full md:hidden">
          <MobileMenuBar />
        </div>
      </div>
    </div>
  )
}

export default Layout
