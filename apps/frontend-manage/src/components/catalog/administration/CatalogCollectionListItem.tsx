import { faFolder } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CatalogCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ObjectAccessLabel from '../ObjectAccessLabel'

function CatalogCollectionListItem({
  collection,
}: {
  collection: CatalogCollection
}) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div
      className="flex h-9 flex-row items-center justify-between border-b border-solid px-1 text-sm hover:cursor-pointer hover:bg-slate-100"
      onClick={() => {
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
          // TODO: trigger modal for requesting access
          alert('WOULD OPEN REQUEST MODAL')
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
        <FontAwesomeIcon icon={faFolder} className="w-4" />
        <div>{collection.name}</div>
        {collection.ownerShortname ? (
          <div className="text-xs text-slate-500">
            {t('manage.resources.byOwner', {
              owner: collection.ownerShortname,
            })}
          </div>
        ) : null}
      </div>
      <div>ACTIONS</div>
    </div>
  )
}

export default CatalogCollectionListItem
