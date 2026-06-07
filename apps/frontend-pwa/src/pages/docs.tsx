import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { H3, TabContent, Tabs, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../components/Layout'

function StudentDocs() {
  const t = useTranslations()

  return (
    <Layout displayName={t('shared.generic.documentation')}>
      {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true' && (
        <UserNotification
          type="warning"
          className={{ root: 'mx-auto mb-3 w-full max-w-5xl text-base' }}
        >
          {t.rich('pwa.studentDocs.assessmentInstanceWarning', {
            b: (text) => <b>{text}</b>,
          })}
        </UserNotification>
      )}
      <Tabs
        defaultValue="features-overview"
        tabs={[
          {
            id: 'tab-features-overview',
            value: 'features-overview',
            label: t('pwa.studentDocs.featuresTitle'),
            data: { cy: 'tab-features-overview' },
          },
          {
            id: 'tab-first-login-account',
            value: 'first-login-account',
            label: t('pwa.studentDocs.firstLoginTitle'),
            data: { cy: 'tab-first-login-account' },
          },
          {
            id: 'tab-app-setup',
            value: 'app-setup',
            label: t('pwa.studentDocs.appSetupTitle'),
            data: { cy: 'tab-app-setup' },
          },
        ]}
        className={{ root: 'mx-auto w-full max-w-5xl' }}
      >
        <div className="prose prose-img:m-0 max-w-none rounded-lg border border-slate-200 p-4">
          <TabContent
            value="features-overview"
            className={{ root: 'mt-0 pt-0' }}
          >
            <H3 className={{ root: 'mt-0' }}>
              {t('pwa.studentDocs.featuresTitle')}
            </H3>
            <DynamicMarkdown
              withProse
              className={{ root: 'prose-headings:mt-0! prose-p:mt-0!' }}
              content={t('pwa.studentDocs.features')}
            />
          </TabContent>

          <TabContent value="first-login-account">
            <H3 className={{ root: 'mt-0' }}>
              {t('pwa.studentDocs.firstLoginTitle')}
            </H3>
            <DynamicMarkdown
              withProse
              className={{ root: 'prose-headings:mt-0 prose-p:mt-0' }}
              content={t('pwa.studentDocs.firstLogin')}
            />
          </TabContent>

          <TabContent value="app-setup">
            <H3 className={{ root: 'mt-0' }}>
              {t('pwa.studentDocs.appSetupTitle')}
            </H3>
            <DynamicMarkdown
              withProse
              className={{ root: 'prose-headings:mt-0 prose-p:mt-0' }}
              content={t('pwa.studentDocs.appSetup', {
                pwa_url: process.env.NEXT_PUBLIC_PWA_URL!,
              })}
            />
          </TabContent>
        </div>
      </Tabs>
      <nav
        aria-label={t('pwa.studentDocs.appLinksTitle')}
        className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="font-semibold">
          {t('pwa.studentDocs.appLinksTitle')}
        </span>
        <a
          href={t('auth.privacyUrl')}
          target="_blank"
          rel="noreferrer"
          className="text-primary-80 hover:underline"
        >
          {t('auth.privacyPolicy')}
        </a>
        <a
          href="mailto:klicker@df.uzh.ch"
          className="text-primary-80 hover:underline"
        >
          {t('pwa.studentDocs.supportEmail')}
        </a>
        <Link href="/editProfile" className="text-primary-80 hover:underline">
          {t('pwa.profile.deleteProfile')}
        </Link>
      </nav>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default StudentDocs
