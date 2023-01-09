import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import Header from './layout/Header'

interface LayoutProps {
  title: string
  children: React.ReactNode
}

function Layout({ title, children }: LayoutProps) {
  const router = useRouter()
  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument)

  if (!dataUser && !loadingUser) {
    router.push('/login')
  }
  if (!dataUser) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-full h-full mx-auto bg-red-100">
      <Header title={title} />
      <div className="max-w-2xl p-2 mx-auto bg-green-100">{children}</div>
    </div>
  )
}

export default Layout
