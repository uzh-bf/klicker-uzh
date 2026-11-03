import Footer from '@klicker-uzh/shared-components/src/Footer'
import LanguageChanger from '@klicker-uzh/shared-components/src/LanguageChanger'
import useStickyState from '@klicker-uzh/shared-components/src/hooks/useStickyState'
import { Button, Checkbox, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'

function SignInOutButton() {
  const t = useTranslations()
  const router = useRouter()

  const {
    value,
    setValue: setTosChecked,
    hasInitialized,
  } = useStickyState(
    'tos-agreement-privacy-2026-09-14-terms-2023-08-26',
    'false'
  )
  const tosChecked = hasInitialized && (value === true || value === 'true')

  const nativeTransaction =
    typeof router.query.nativeTransaction === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(router.query.nativeTransaction)
      ? router.query.nativeTransaction
      : null
  const callbackUrl = nativeTransaction
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/native/complete?transaction=${nativeTransaction}`
    : (router.query?.redirectTo as string) || process.env.NEXT_PUBLIC_MANAGE_URL

  const { data: session, status } = useSession()

  if (status === 'loading') return null

  if (session) {
    return (
      <>
        <UserNotification
          message={t('auth.signedInAs', { username: session?.user?.email! })}
          type="info"
          className={{ root: '-mt-4 mb-4' }}
        />
        <div className="flex w-full flex-row items-center justify-between">
          <Button
            destructive
            onClick={() => signOut()}
            data={{ cy: 'auth-logout-button' }}
          >
            {t('shared.generic.logout')}
          </Button>
          <Button
            primary
            onClick={() => router.push(callbackUrl!)}
            data={{ cy: 'auth-open-manage-button' }}
          >
            {t('shared.generic.openApplication')}
          </Button>
        </div>
      </>
    )
  }

  const eduIdLoginHintId = 'eduid-login-disabled-reason'

  return (
    <div className="flex flex-col gap-4">
      <Head>
        <title>Lecturer Login</title>
        <meta
          name="description"
          content="Log in interface for lecturers to manage their courses and materials."
        />
      </Head>
      {nativeTransaction && (
        <p className="font-semibold">{t('control.home.appName')}</p>
      )}
      <p className="rounded border-slate-300 bg-slate-100 px-3 py-2 shadow">
        {t('auth.loginInfo')}
      </p>
      <Checkbox
        id="lecturer-policy-agreement"
        size="xl"
        disabled={!hasInitialized}
        className={{
          root: 'h-11 w-11',
          label: 'min-w-0 max-w-none flex-1',
        }}
        data={{ cy: 'tos-checkbox' }}
        label={
          <label
            htmlFor="lecturer-policy-agreement"
            className="block cursor-pointer py-2 text-base leading-relaxed [overflow-wrap:anywhere]"
          >
            {t.rich('auth.tosAgreement', {
              privacy: () => (
                <a
                  className="rounded-sm text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
                  href={t('auth.privacyUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.privacyPolicy')}
                </a>
              ),
              tos: () => (
                <a
                  className="rounded-sm text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
                  href={t('auth.tosUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.termsOfService')}
                </a>
              ),
            })}
          </label>
        }
        onCheck={() => setTosChecked(String(!tosChecked))}
        checked={tosChecked}
      />

      {!tosChecked && (
        <span id={eduIdLoginHintId} className="sr-only">
          {t('auth.tosAgreementRequired')}
        </span>
      )}
      <span
        className="block"
        title={!tosChecked ? t('auth.tosAgreementRequired') : undefined}
      >
        <Button
          fluid
          disabled={!tosChecked}
          aria-describedby={!tosChecked ? eduIdLoginHintId : undefined}
          data={{ cy: 'eduid-login-button' }}
          className={{ root: 'p-4 disabled:opacity-50' }}
          onClick={() =>
            signIn(process.env.NEXT_PUBLIC_EDUID_ID, {
              callbackUrl,
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
      </span>
      <Button
        className={{
          root: 'min-h-11 justify-center italic disabled:opacity-50',
        }}
        disabled={!tosChecked}
        data={{ cy: 'delegated-login-button' }}
        onClick={() =>
          signIn('delegation', {
            callbackUrl,
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
    <div className="md:grow-0! m-auto flex w-full grow flex-col md:max-w-2xl md:rounded-lg md:border md:shadow">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 md:p-8">
        <div className="w-full border-b px-5 pb-4 text-center sm:px-8">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-6 sm:px-10 md:mx-0">
          <H1 className={{ root: 'mb-0 min-w-0 [overflow-wrap:anywhere]' }}>
            {t('auth.authentication')}
          </H1>
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
      <div className="w-full flex-none">
        <Footer className="text-xs!" />
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
