import { faFolderPlus } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function CreateCatalogCollectionButton({
  setCollectionModalOpen,
}: {
  setCollectionModalOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return (
    <Button
      type="button"
      onClick={() => setCollectionModalOpen(true)}
      data={{ cy: 'create-catalog-collection-button' }}
    >
      <Button.Icon icon={faFolderPlus} />
      <Button.Label>{t('manage.catalog.createCatalogCollection')}</Button.Label>
    </Button>
  )
}

export default CreateCatalogCollectionButton
