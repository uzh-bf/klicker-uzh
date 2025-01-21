import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ObjectImport from './import/ObjectImport'

function CatalogBrowser() {
  const t = useTranslations()

  return (
    <div className="h-full">
      <H2>{t('manage.general.catalog')}</H2>
      <div>SHARING REQUESTS FOR APPROVAL</div>
      <ObjectImport />
    </div>
  )
}

export default CatalogBrowser
