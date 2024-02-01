import Footer from '@klicker-uzh/shared-components/src/Footer'
import LanguageChanger from '@klicker-uzh/shared-components/src/LanguageChanger'
import { Button, Checkbox, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'

import useStickyState from 'src/hooks/useStickyState'

function SignInOutButton() {
  const t = useTranslations()
  const router = useRouter()

  const { value: tosChecked, setValue: setTosChecked } = useStickyState(
    'tos-agreement-2024',
    'false'
  )

  const { data: session, status } = useSession()

  if (status === 'loading') return null

  if (session) {
    return (
      <>
        <UserNotification
          message={t('auth.signedInAs', { username: session?.user?.email })}
          type="info"
          className={{ root: '-mt-4' }}
        />
        <br />
        <a href={process.env.NEXT_PUBLIC_MANAGE_URL}>
          <Button>MANAGE</Button>
        </a>
        <br />
        <Button onClick={() => signOut()} data={{ cy: 'auth-logout-button' }}>
          {t('shared.generic.logout')}
        </Button>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="px-3 py-2 rounded shadow bg-slate-100 border-slate-300">
        {t('auth.loginInfo')}
      </p>
      <Checkbox
        data={{ cy: 'tos-checkbox' }}
        label={
          <div className="text-sm">
            {t.rich('auth.tosAgreement', {
              privacy: () => (
                <a
                  className="text-blue-500 underline hover:text-red-500"
                  href={t('auth.privacyUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.privacyPolicy')}
                </a>
              ),
              tos: () => (
                <a
                  className="text-blue-500 underline hover:text-red-500"
                  href={t('auth.tosUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.termsOfService')}
                </a>
              ),
            })}
          </div>
        }
        onCheck={() => setTosChecked(!tosChecked)}
        checked={Boolean(tosChecked)}
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
        className={{
          root: 'disabled:opacity-50 justify-center italic',
        }}
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
        {t('auth.delegatedAccess')}
      </Button>
    </div>
  )
}

export function Index() {
  const router = useRouter()
  const t = useTranslations()

  return (
    <div className="m-auto flex w-full md:max-w-2xl flex-grow flex-col md:!flex-grow-0 md:rounded-lg md:border md:shadow">
      <div className="flex flex-col items-center justify-center flex-1 gap-8 md:p-8">
        <div className="w-full px-5 pb-4 text-center border-b sm:px-8">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>
        <div className="flex flex-row justify-between w-full px-6 sm:px-10 md:mx-0">
          <H1 className={{ root: 'mb-0' }}>{t('auth.authentication')}</H1>
          <div>
            <LanguageChanger
              value={router.locale as string}
              onChange={(newValue) => {
                const { pathname, asPath, query } = router
                router.push({ pathname, query }, asPath, {
                  locale: newValue,
                })
              }}
            />
          </div>
        </div>
        <div className="w-full px-6 sm:px-10">
          <SignInOutButton />
        </div>
      </div>
      <div className="flex-none w-full">
        <Footer className="!text-xs" />
      </div>
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Index
