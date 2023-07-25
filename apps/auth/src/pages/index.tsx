import { signIn, signOut, useSession } from 'next-auth/react'
import { Source_Sans_3 } from 'next/font/google'

const sourceSans3 = Source_Sans_3({ subsets: ['latin'] })

export default function Home() {
  const { data: session } = useSession()

  if (session) {
    return (
      <>
        {' '}
        Signed in as {session?.user?.email} <br />{' '}
        <button onClick={() => signOut()}>Sign out</button>{' '}
      </>
    )
  }
  return (
    <>
      {' '}
      Not signed in <br /> <button onClick={() => signIn()}>
        Sign in
      </button>{' '}
    </>
  )
}
