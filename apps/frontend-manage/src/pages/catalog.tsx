import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import CatalogBrowser from '~/components/catalog/CatalogBrowser'
import UserGroupsManagement from '~/components/catalog/UserGroupsManagement'
import Layout from '~/components/Layout'

function Catalog() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.general.catalog')}>
      <ResizablePanelGroup
        autoSaveId="catalog-top-level"
        key={`panel-group-catalog`}
        direction="horizontal"
      >
        <ResizablePanel defaultSize={70} minSize={50} className="pr-4">
          <CatalogBrowser />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          collapsible
          collapsedSize={0}
          className="gap-2 border-l pl-4"
        >
          <UserGroupsManagement />
        </ResizablePanel>
      </ResizablePanelGroup>
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

export default Catalog
