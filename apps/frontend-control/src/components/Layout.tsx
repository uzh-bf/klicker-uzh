import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import Header from './layout/Header'
import MobileMenuBar from './layout/MobileMenuBar'

interface LayoutProps {
  title: string
  children: React.ReactNode
  sessionId?: string
  className?: string
}

function Layout({ title, children, sessionId, className }: LayoutProps) {
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

  return (
    <div className="flex flex-col w-full h-full">
      <Head>
        <title>KlickerUZH Controller {title}</title>
        <meta
          name="description"
          content="KlickerUZH Controller App"
          charSet="utf-8"
        ></meta>
      </Head>

      <div className={twMerge('h-full overflow-y-none', className)}>
        <div className="fixed top-0 z-10 w-full">
          <Header title={title} />
        </div>

        <div className="flex flex-col p-4 mt-11 mb-12 md:mb-0 overflow-y-auto [height:_calc(100%-5.75rem)] md:[height:_calc(100%-2.75rem)]">
          {children}
        </div>

        <div className="fixed bottom-0 w-full h-12 md:hidden">
          <MobileMenuBar sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}

export default Layout
