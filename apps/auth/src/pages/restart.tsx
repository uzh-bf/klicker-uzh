import Footer from '@klicker-uzh/shared-components/src/Footer'
import LanguageChanger from '@klicker-uzh/shared-components/src/LanguageChanger'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'

// Neutral restart page for authentication attempts whose transaction context
// could not be verified (unknown, expired, malformed or contradictory callback
// context). It deliberately offers both audiences as explicit choices and
// never continues a failed attempt automatically.
//
// Recovery from a failure inside NextAuth keeps the audience that was already
// verified for the attempt (see lib/errorRecovery.ts). In that case only the
// matching entry point is offered, so a retry cannot drift into the other
// audience's account handling.
export default function Restart() {
  const router = useRouter()
  const t = useTranslations()
  const participantRestart = router.query.audience === 'participant'

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
          <H1 className={{ root: 'mb-0' }}>{t('auth.restart.title')}</H1>
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
        <div className="flex w-full flex-col gap-4 px-6 sm:px-10">
          {router.query.error ? (
            <UserNotification type="warning">
              {t('auth.restart.errorInfo')}
            </UserNotification>
          ) : (
            <UserNotification type="info">
              {t('auth.restart.info')}
            </UserNotification>
          )}
          <Button
            primary
            fluid
            className={{ root: 'p-4' }}
            data={{ cy: 'restart-student-login-button' }}
            onClick={() => router.push('/student')}
          >
            {t('auth.restart.studentLogin')}
          </Button>
          {!participantRestart && (
            <Button
              fluid
              className={{ root: 'p-4' }}
              data={{ cy: 'restart-lecturer-login-button' }}
              onClick={() => router.push('/')}
            >
              {t('auth.restart.lecturerLogin')}
            </Button>
          )}
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
