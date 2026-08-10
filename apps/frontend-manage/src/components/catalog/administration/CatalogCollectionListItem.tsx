import { faClock, faFolder } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faEllipsisVertical,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogCollection,
  ObjectAccess,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Dropdown, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import useCatalogCollectionActionsDropdown from '../../../lib/hooks/useCatalogCollectionActionsDropdown'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogChangeAccessModal from '../actions/CatalogChangeAccessModal'
import CatalogRequestModal from '../actions/CatalogRequestModal'
import CatalogCollectionDeletionModal from '../collections/CatalogCollectionDeletionModal'
import CatalogCollectionNameChangeModal from '../collections/CatalogCollectionNameChangeModal'
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
  const [deletionModal, setDeletionModal] = useState(false)
  const [requestModal, setRequestModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [nameChangeModal, setNameChangeModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(collection.access)

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

  const handlePrimaryAction = () => {
    if (
      collection.access === ObjectAccess.Public ||
      collection.isShared ||
      collection.isManager
    ) {
      router.push(`/resources/catalog/${collection.id}`)
    } else if (
      collection.access === ObjectAccess.Restricted ||
      !collection.isRequested
    ) {
      setRequestModal(true)
    }
  }

  return (
    <>
      <div className="flex h-9 flex-row items-center justify-between border-b border-solid px-3 py-6 text-sm hover:cursor-pointer hover:bg-slate-100">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-row items-center justify-between text-left"
          onClick={handlePrimaryAction}
          data-cy={`catalog-object-${collection.name}`}
        >
          <span className="flex min-w-0 flex-row items-center gap-2">
            <ObjectAccessLabel
              iconOnly
              accessType={collection.access}
              className="mr-2 w-3 text-sm"
            />
            <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
            <span>{collection.name}</span>
            {collection.ownerShortname ? (
              <span className="text-xs text-slate-500">
                {t('manage.resources.byOwner', {
                  owner: collection.ownerShortname,
                })}
              </span>
            ) : null}
          </span>
          <span className="flex flex-row items-center gap-2">
            {collection.isRequested ? (
              <span className="flex flex-row items-center gap-1.5">
                <FontAwesomeIcon icon={faClock} />
                <span>{t('manage.catalog.accessRequested')}</span>
              </span>
            ) : null}
            {collection.isShared ? (
              <span className="flex flex-row items-center gap-1.5">
                <FontAwesomeIcon icon={faCheck} />
                <span>{t('manage.catalog.accessGranted')}</span>
              </span>
            ) : null}
          </span>
        </button>
        <div className="flex flex-row items-center gap-2">
          {collection.isEditor && (
            <button
              type="button"
              aria-label={t('shared.generic.edit')}
              onClick={() => setNameChangeModal(true)}
              className="hover:cursor-pointer"
              data-cy={`change-catalog-collection-name-${collection.name}`}
            >
              <FontAwesomeIcon icon={faPencil} />
            </button>
          )}
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
            <div data-catalog-collection-actions>
              <Dropdown
                items={dropdownItems}
                trigger={<FontAwesomeIcon icon={faEllipsisVertical} />}
                className={{
                  viewport: 'z-20',
                  item: 'py-0.5 text-sm',
                  trigger:
                    'h-7 w-7 rounded-full border-none bg-transparent text-gray-500 hover:bg-gray-100',
                }}
                data={{ cy: `catalog-collection-${collection.name}-actions` }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {collection.isManager ? (
        <>
          {sharingModal && (
            <ObjectSharingModalWrapper
              onClose={() => setSharingModal(false)}
              objectUuid={collection.id}
              objectName={collection.name}
              objectType={ObjectType.CatalogCollection}
            />
          )}
          {deletionModal && (
            <CatalogCollectionDeletionModal
              catalogCollectionId={collection.id}
              catalogCollectionName={collection.name}
              onClose={() => setDeletionModal(false)}
              onSuccess={() =>
                toast({
                  type: 'success',
                  message: t('manage.catalog.deletionSuccessful'),
                  options: { duration: 3500 },
                })
              }
            />
          )}
          {changeAccessModal && (
            <CatalogChangeAccessModal
              onClose={() => setChangeAccessModal(false)}
              objectType={ObjectType.CatalogCollection}
              objectName={collection.name}
              newAccess={newAccess}
              catalogCollectionId={collection.id}
            />
          )}
        </>
      ) : null}

      {collection.isEditor && nameChangeModal ? (
        <CatalogCollectionNameChangeModal
          catalogCollectionId={collection.id}
          name={collection.name}
          onClose={() => setNameChangeModal(false)}
        />
      ) : null}

      {/* functionality for users without access to request it for restricted catalog collections */}
      {isRequestable && requestModal ? (
        <CatalogRequestModal
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.requestCatalogObjectSuccess'),
              options: { duration: 3500 },
            })
            setRequestModal(false)
          }}
          onClose={() => setRequestModal(false)}
          objectType={ObjectType.CatalogCollection}
          objectId={collection.id}
          objectName={collection.name}
          objectOwner={collection.ownerShortname}
          objectAccess={collection.access}
        />
      ) : null}
    </>
  )
}

export default CatalogCollectionListItem
