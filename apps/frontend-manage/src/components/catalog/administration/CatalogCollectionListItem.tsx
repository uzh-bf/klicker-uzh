import { faFolder } from '@fortawesome/free-regular-svg-icons'
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CatalogCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import useCatalogCollectionActionsDropdown from '../../../lib/hooks/useCatalogCollectionActionsDropdown'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogCollectionSharingModal from '../collections/CatalogCollectionSharingModal'

function CatalogCollectionListItem({
  collection,
}: {
  collection: CatalogCollection
}) {
  const t = useTranslations()
  const router = useRouter()

  const [sharingModal, setSharingModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [requestModal, setRequestModal] = useState(false)

  const dropdownItems = useCatalogCollectionActionsDropdown({
    catalogCollectionId: collection.id,
    isShareable: collection.isOwnerOrAdmin,
    isDeletable: collection.isOwnerOrAdmin,
    isRequestable:
      collection.access === ObjectAccess.Restricted &&
      !collection.isRequested &&
      !collection.isShared,
    isViewable: collection.isShared,
    setSharingModal,
    setDeletionModal,
    setRequestModal,
  })

  // TODO: ownership transfer method for catalog collection
  // TODO: deletion modal
  // TODO: request modal

  return (
    <>
      <div
        className="flex h-9 flex-row items-center justify-between border-b border-solid px-1 text-sm hover:cursor-pointer hover:bg-slate-100"
        onClick={(e) => {
          e?.stopPropagation()
          if (
            collection.access === ObjectAccess.Public ||
            collection.isShared ||
            collection.isOwnerOrAdmin
          ) {
            router.push(
              `resources/catalog`,
              {
                query: { catalogCollectionId: collection.id },
              },
              { shallow: true }
            )
          } else if (
            collection.access === ObjectAccess.Restricted ||
            !collection.isRequested
          ) {
            setRequestModal(true)
          }
        }}
        data-cy={`catalog-object-${collection.name}`}
      >
        <div className="flex flex-row items-center gap-2">
          <ObjectAccessLabel
            iconOnly
            accessType={collection.access}
            className="mr-2 w-3 text-sm"
          />
          <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
          <div>{collection.name}</div>
          {collection.ownerShortname ? (
            <div className="text-xs text-slate-500">
              {t('manage.resources.byOwner', {
                owner: collection.ownerShortname,
              })}
            </div>
          ) : null}
        </div>
        {dropdownItems.length > 0 ? (
          <Dropdown
            items={dropdownItems}
            trigger={
              <ForwardRefButton
                basic
                className={{
                  root: 'rounded-full p-1.5 text-gray-500 hover:bg-gray-100',
                }}
              >
                <Button.Icon withoutLabel icon={faEllipsisVertical} />
              </ForwardRefButton>
            }
            className={{ viewport: 'z-20' }}
          />
        ) : null}
      </div>
      {collection.isOwnerOrAdmin ? (
        <CatalogCollectionSharingModal
          catalogCollectionId={collection.id}
          catalogCollectionName={collection.name}
          open={sharingModal}
          onClose={() => setSharingModal(false)}
          isOwner={collection.isOwner ?? false}
          onOwnershipTransfer={async () => null} // TODO: implement
        />
      ) : null}
    </>
  )
}

export default CatalogCollectionListItem
