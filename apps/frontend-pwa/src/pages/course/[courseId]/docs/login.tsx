import { Markdown } from '@klicker-uzh/markdown'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Login() {
  const t = useTranslations()

  return (
    <DocsLayout>
      {(courseInformation) => (
        <Markdown
          withProse
          className={{ root: 'prose-headings:mt-0' }}
          content={t('pwa.studentDocs.firstLogin', {
            pwa_url: process.env.NEXT_PUBLIC_PWA_URL,
            shortname: courseInformation.owner.shortname,
          })}
        />
      )}
    </DocsLayout>
  )
}

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Login
