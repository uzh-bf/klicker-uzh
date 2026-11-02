import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import AiBetaUnavailable from '../../components/AiBetaUnavailable'
import ElementGenerationBuild from '../../components/elements/generation/ElementGenerationBuild'
import ElementGenerationConfigure from '../../components/elements/generation/ElementGenerationConfigure'
import Layout from '../../components/Layout'
import { useAiFeaturesEnabled } from '../../lib/hooks/useAiFeaturesEnabled'

function ElementGenerationPage() {
  const t = useTranslations('manage.elementGeneration')
  const router = useRouter()
  const aiFeaturesEnabled = useAiFeaturesEnabled()
  const buildId =
    typeof router.query.buildId === 'string' ? router.query.buildId : undefined
  const kbId =
    typeof router.query.kbId === 'string' ? router.query.kbId : undefined

  async function showBuild(id: string) {
    await router.push(
      { pathname: '/elements/generate', query: { buildId: id } },
      undefined,
      { shallow: true }
    )
  }

  async function showConfigure() {
    await router.push('/elements/generate', undefined, { shallow: true })
  }

  return (
    <Layout displayName={t('title')}>
      {!aiFeaturesEnabled ? (
        <AiBetaUnavailable />
      ) : (
        <main className="mx-auto w-full max-w-7xl px-2 py-4 md:px-4">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              {t('eyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {t('description')}
            </p>
          </div>
          {buildId ? (
            <ElementGenerationBuild buildId={buildId} onNew={showConfigure} />
          ) : (
            <ElementGenerationConfigure
              preselectedKbId={kbId}
              onStarted={showBuild}
            />
          )}
        </main>
      )}
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

export default ElementGenerationPage
