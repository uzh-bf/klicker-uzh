import { signIn, signOut, useSession } from 'next-auth/react'

import { Button, H1 } from '@uzh-bf/design-system'
import Image from 'next/image'
import Footer from 'shared-components/src/Footer'

function SignInOutButton() {
  const { data: session } = useSession()

  if (session) {
    return (
      <>
        Signed in as {session?.user?.email} <br />{' '}
        <Button onClick={() => signOut()}>Sign out</Button>
      </>
    )
  }

  return (
    <Button className={{ root: 'p-4' }} onClick={() => signIn('eduid-test')}>
      <Image
        src="/edu-id-logo.svg"
        width={300}
        height={90}
        alt="Logo"
        className="mx-auto"
        data-cy="login-logo"
      />
    </Button>
  )
}

export function Index({}) {
  return (
    <div className="m-auto flex max-w-2xl flex-grow flex-col md:!flex-grow-0 md:rounded-lg md:border md:shadow">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 md:p-8">
        <div className="w-full border-b pb-4 text-center">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>
        <div>
          <H1>Authentication</H1>
        </div>
        <div>
          <SignInOutButton />
        </div>
      </div>
      <div className="w-full flex-none">
        <Footer />
      </div>
    </div>
  )
}

export default Index
