import Footer from '@klicker-uzh/shared-components/src/Footer'
import { Button, Checkbox, H1 } from '@uzh-bf/design-system'
import { signIn, signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import { useRouter } from 'next/router'

import useStickyState from 'src/hooks/useStickyState'

function SignInOutButton() {
  const router = useRouter()

  const { data: session } = useSession()

  const [tosChecked, setTosChecked] = useStickyState('tos-agreement', false)

  if (session) {
    return (
      <>
        Signed in as {session?.user?.email} <br />{' '}
        <Button onClick={() => signOut()}>Sign out</Button>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label={
          <div className="text-sm">
            I consent to the{' '}
            <a
              className="underline text-blue-500 hover:text-red-500"
              href="https://www.klicker.uzh.ch/terms_of_service"
              target="_blank"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              className="underline text-blue-500 hover:text-red-500"
              href="https://www.klicker.uzh.ch/privacy_policy"
              target="_blank"
            >
              Privacy Policy
            </a>
          </div>
        }
        onCheck={() => setTosChecked(!tosChecked)}
        checked={tosChecked}
      />

      <Button
        disabled={!tosChecked}
        data={{ cy: 'eduid-login-button' }}
        className={{ root: 'p-4 disabled:opacity-50' }}
        onClick={() =>
          signIn(process.env.NEXT_PUBLIC_EDUID_ID, {
            callbackUrl:
              (router.query?.redirectTo as string) ??
              process.env.NEXT_PUBLIC_DEFAULT_REDIRECT,
          })
        }
      >
        <Image
          src="/edu-id-logo.svg"
          width={300}
          height={90}
          alt="Logo"
          className="mx-auto"
          data-cy="login-logo"
        />
      </Button>
      <Button
        className={{ root: 'disabled:opacity-50' }}
        disabled={!tosChecked}
        data={{ cy: 'delegated-login-button' }}
        onClick={() =>
          signIn('delegation', {
            callbackUrl:
              (router.query?.redirectTo as string) ??
              process.env.NEXT_PUBLIC_DEFAULT_REDIRECT,
          })
        }
      >
        Delegated Login
      </Button>
    </div>
  )
}

export function Index() {
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
