import Footer from '@klicker-uzh/shared-components/src/Footer'
import LanguageChanger from '@klicker-uzh/shared-components/src/LanguageChanger'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useStudentSession } from '../hooks/useStudentSession'
import { DEFAULT_STUDENT_HOSTS } from '../lib/constants'
import { validateRedirectTarget } from '../lib/redirectTarget'

// Return target of the assessment login. The proxy already rejects an invalid
// `redirectTo` for this route; validating again keeps the client-side
// navigation from depending on that single gate. Only an absolute URL on an
// allowed assessment host is used, everything else returns to the assessment
// root.
function assessmentReturnTarget(
  requested: string | string[] | undefined
): string {
  const fallback =
    process.env.NEXT_PUBLIC_ASSESSMENT_URL ||
    'https://assessment.klicker.uzh.ch'

  const validation = validateRedirectTarget(
    typeof requested === 'string' ? requested : undefined,
    DEFAULT_STUDENT_HOSTS,
    { secure: process.env.NODE_ENV === 'production' }
  )

  return validation.url ?? fallback
}

// Signs out of the participant session only. The explicit ?participant=true
// parameter routes the NextAuth signout through the participant
// configuration, so a lecturer (manager) session in the same browser is
// never cleared by an assessment logout.
async function participantSignOut() {
  const csrfResponse = await fetch('/api/auth/csrf')
  const { csrfToken } = await csrfResponse.json()
  await fetch('/api/auth/signout?participant=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csrfToken, json: 'true' }),
  })
}

function StudentSignIn() {
  const t = useTranslations()
  const router = useRouter()
  const { status, participant, refetch } = useStudentSession()

  const redirectTo = assessmentReturnTarget(router.query?.redirectTo)

  if (status === 'loading') {
    return null
  }

  // A failed session check is not proof of a missing session: the student may
  // hold a valid one while the lookup itself is unavailable. Offer the retry
  // instead of sending them through authentication again.
  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <UserNotification type="warning">
          {t('auth.sessionCheckFailed')}
        </UserNotification>
        <Button
          primary
          fluid
          className={{ root: 'p-4' }}
          data={{ cy: 'student-session-retry-button' }}
          onClick={() => refetch()}
        >
          {t('auth.sessionCheckRetry')}
        </Button>
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className="flex flex-col gap-4">
        <UserNotification
          type="info"
          message={t('auth.signedInAs', { username: participant?.email ?? '' })}
        />
        <Button
          primary
          fluid
          className={{ root: 'p-4' }}
          data={{ cy: 'student-open-app-button' }}
          onClick={() => {
            // Use full navigation to assessment
            if (typeof window !== 'undefined') {
              window.location.href = redirectTo
            }
          }}
        >
          {t('shared.generic.openApplication')}
        </Button>
        <Button
          fluid
          className={{ root: 'p-4' }}
          data={{ cy: 'student-logout-button' }}
          onClick={async () => {
            await participantSignOut()
            await refetch()
          }}
        >
          {t('shared.generic.logout')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Head>
        <title>Student Login</title>
        <meta
          name="description"
          content="Login interface for students to access assessments."
        />
      </Head>

      <UserNotification type="warning">
        {t('pwa.assessment.eduIdRequired')}
      </UserNotification>
      <Button
        fluid
        className={{ root: 'p-4' }}
        data={{ cy: 'student-eduid-login-button' }}
        onClick={() =>
          signIn(
            process.env.NEXT_PUBLIC_EDUID_ID || 'eduid',
            { callbackUrl: redirectTo },
            { participant: 'true' }
          )
        }
      >
        <Image
          src="/edu-id-logo.svg"
          width={300}
          height={90}
          alt="Edu-ID Logo"
          className="mx-auto"
        />
      </Button>
    </div>
  )
}

export default function Student() {
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
        <div className="flex w-full flex-row justify-between px-6 sm:px-10 md:mx-0">
          <H1 className={{ root: 'mb-0' }}>{t('pwa.assessment.title')}</H1>
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
          <StudentSignIn />
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
