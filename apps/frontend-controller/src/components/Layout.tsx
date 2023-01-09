import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

interface LayoutProps {
  children: React.ReactNode
}

function Layout({ children }: LayoutProps) {
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
    <div className="h-full max-w-2xl mx-auto bg-red-100">
      <div>Logged in as: {dataUser.userProfile?.email}</div>
      {children}
    </div>
  )
}

export default Layout
