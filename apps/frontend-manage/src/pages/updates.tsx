import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1 } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import ProductUpdateCard from '../components/productUpdates/ProductUpdateCard'
import { useProductUpdates } from '../components/productUpdates/useProductUpdates'

function Updates() {
  const t = useTranslations()
  const { entries, loading, recordPresentation, markRead, dismiss } =
    useProductUpdates()

  return (
    <Layout displayName={t('manage.productUpdates.pageTitle')}>
      {loading ? (
        <Loader />
      ) : (
        <div
          className="mx-auto flex max-w-3xl flex-col gap-4"
          data-cy="product-updates-page"
        >
          <H1>{t('manage.productUpdates.pageTitle')}</H1>
          {entries.length === 0 ? (
            <div className="text-slate-600" data-cy="product-updates-empty">
              {t('manage.productUpdates.empty')}
            </div>
          ) : (
            // Unlike the feed, this page keeps dismissed entries: it is the
            // persistent record of everything the lecturer may still read.
            entries.map((entry) => (
              <ProductUpdateCard
                key={entry.update.id}
                update={entry.update}
                state={entry.state}
                onPresent={recordPresentation}
                onRead={markRead}
                onDismiss={entry.dismissed ? undefined : dismiss}
              />
            ))
          )}
        </div>
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

export default Updates
