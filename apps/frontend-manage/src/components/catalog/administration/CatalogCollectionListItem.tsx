import { faClock, faFolder } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faEllipsisVertical,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CatalogCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import useCatalogCollectionActionsDropdown from '../../../lib/hooks/useCatalogCollectionActionsDropdown'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogCollectionChangeAccessModal from '../collections/CatalogCollectionChangeAccessModal'
import CatalogCollectionDeletionModal from '../collections/CatalogCollectionDeletionModal'
import CatalogCollectionDeletionSuccessToast from '../collections/CatalogCollectionDeletionSuccessToast'
import CatalogCollectionNameChangeModal from '../collections/CatalogCollectionNameChangeModal'
import CatalogCollectionRequestAccessModal from '../collections/CatalogCollectionRequestAccessModal'
import CatalogCollectionRequestAccessSuccessToast from '../collections/CatalogCollectionRequestAccessSuccessToast'
import CatalogCollectionSharingModal from '../collections/CatalogCollectionSharingModal'
import TransferCatalogCollectionOwnershipModal from '../collections/TransferCatalogCollectionOwnershipModal'
import ObjectAccessSelection from './ObjectAccessSelection'

function CatalogCollectionListItem({
  collection,
}: {
  collection: CatalogCollection
}) {
  const t = useTranslations()
  const router = useRouter()

  // modal states
  const [sharingModal, setSharingModal] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [requestModal, setRequestModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [nameChangeModal, setNameChangeModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(collection.access)

  // toast states
  const [showRequestSuccessToast, setShowRequestSuccessToast] = useState(false)
  const [showDeletionSuccessToast, setShowDeletionSuccessToast] =
    useState(false)

  // access can be requested if not done already, not shared, and not owned
  const isRequestable =
    collection.access === ObjectAccess.Restricted &&
    !collection.isRequested &&
    !collection.isShared &&
    !collection.isOwner

  const dropdownItems = useCatalogCollectionActionsDropdown({
    catalogCollectionId: collection.id,
    isManager: collection.isManager,
    isShared: collection.isShared,
    isRequestable,
    setSharingModal,
    setDeletionModal,
    setRequestModal,
  })

  return (
    <>
      <div
        className="flex h-9 flex-row items-center justify-between border-b border-solid px-1 text-sm hover:cursor-pointer hover:bg-slate-100"
        onClick={(e) => {
          e?.stopPropagation()
          if (
            collection.access === ObjectAccess.Public ||
            collection.isShared ||
            collection.isManager
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
          {collection.isEditor && (
            <FontAwesomeIcon
              icon={faPencil}
              onClick={(e) => {
                e.stopPropagation()
                setNameChangeModal(true)
              }}
              className="hover:cursor-pointer"
              data-cy={`change-catalog-collection-name-${collection.name}`}
            />
          )}
          {collection.ownerShortname ? (
            <div className="text-xs text-slate-500">
              {t('manage.resources.byOwner', {
                owner: collection.ownerShortname,
              })}
            </div>
          ) : null}
        </div>
        <div className="flex flex-row items-center gap-2">
          {collection.isRequested ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} />
              <div>{t('manage.catalog.accessRequested')}</div>
            </div>
          ) : null}
          {collection.isShared ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} />
              <div>{t('manage.catalog.accessGranted')}</div>
            </div>
          ) : null}
          {collection.isManager ? (
            <div className="ml-2">
              <ObjectAccessSelection
                compact
                value={collection.access}
                onChange={(access) => {
                  setNewAccess(access as ObjectAccess)
                  setChangeAccessModal(true)
                }}
                cyPrefix={collection.name}
              />
            </div>
          ) : null}
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
              data={{ cy: `catalog-collection-${collection.name}-actions` }}
            />
          ) : null}
        </div>
      </div>

      {collection.isManager ? (
        <>
          <CatalogCollectionSharingModal
            catalogCollectionId={collection.id}
            catalogCollectionName={collection.name}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
            isOwner={collection.isOwner ?? false}
            onOwnershipTransfer={() => setTransferModal(true)}
          />
          <TransferCatalogCollectionOwnershipModal
            catalogCollectionId={collection.id}
            catalogCollectionName={collection.name}
            open={transferModal}
            onClose={() => setTransferModal(false)}
          />
          <CatalogCollectionDeletionModal
            catalogCollectionId={collection.id}
            catalogCollectionName={collection.name}
            open={deletionModal}
            onClose={() => setDeletionModal(false)}
            onSuccess={() => setShowDeletionSuccessToast(true)}
          />
          <CatalogCollectionChangeAccessModal
            catalogCollection={collection}
            newAccess={newAccess}
            open={changeAccessModal}
            onClose={() => setChangeAccessModal(false)}
          />
        </>
      ) : null}
      {collection.isEditor ? (
        <CatalogCollectionNameChangeModal
          catalogCollectionId={collection.id}
          name={collection.name}
          open={nameChangeModal}
          onClose={() => setNameChangeModal(false)}
        />
      ) : null}

      {isRequestable && (
        <CatalogCollectionRequestAccessModal
          catalogCollectionId={collection.id}
          catalogCollectionName={collection.name}
          ownerShortname={collection.ownerShortname ?? undefined}
          open={requestModal}
          onClose={() => setRequestModal(false)}
          onSuccess={() => setShowRequestSuccessToast(true)}
        />
      )}

      <CatalogCollectionRequestAccessSuccessToast
        open={showRequestSuccessToast}
        onClose={() => setShowRequestSuccessToast(false)}
      />
      <CatalogCollectionDeletionSuccessToast
        open={showDeletionSuccessToast}
        onClose={() => setShowDeletionSuccessToast(false)}
      />
    </>
  )
}

export default CatalogCollectionListItem
