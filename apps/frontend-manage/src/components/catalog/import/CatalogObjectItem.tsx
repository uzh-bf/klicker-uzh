import {
  faClock,
  faCopy,
  faHandPointer,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faList,
  faX,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  CatalogObjectType,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ObjectAccessSelection from '../administration/ObjectAccessSelection'
import ObjectAccessLabel from '../ObjectAccessLabel'
import ObjectAccessRequestModal from './ObjectAccessRequestModal'
import ObjectChangeAccessModal from './ObjectChangeAccessModal'
import ObjectImportModal from './ObjectImportModal'
import ObjectRemovalModal from './ObjectRemovalModal'
import ObjectRequestCancellationModal from './ObjectRequestCancellationModal.tsx'

function CatalogObjectItem({
  object,
  catalogCollectionId,
  managedAccess,
}: {
  object: CatalogObject
  catalogCollectionId?: string
  managedAccess: boolean
}) {
  const t = useTranslations()
  const objectTypeIcons: Record<CatalogObjectType, IconDefinition> = {
    [CatalogObjectType.AnswerCollection]: faList,
  }

  const actionsDisabled = object.isOwner || object.isShared
  const [requestModal, setRequestModal] = useState(false)
  const [requestCancellationModal, setRequestCancellationModal] =
    useState(false)
  const [importModal, setImportModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(object.access)

  return (
    <>
      <div
        className="flex flex-row items-center justify-between border-b border-solid px-1 py-1 text-sm hover:bg-slate-100"
        onClick={() => {
          if (
            actionsDisabled ||
            (object.isRequested && object.access === ObjectAccess.Restricted)
          )
            return

          object.access === ObjectAccess.Public
            ? setImportModal(true)
            : setRequestModal(true)
        }}
        data-cy={`catalog-object-${object.name}`}
      >
        <div className="flex flex-row items-center gap-2">
          <ObjectAccessLabel
            iconOnly
            accessType={object.access}
            className="mr-2 w-3 text-sm"
          />
          <FontAwesomeIcon
            icon={objectTypeIcons[object.objectType]}
            size="sm"
          />
          <div>{object.name}</div>
          {object.ownerShortname ? (
            <div className="text-xs text-slate-500">
              {t('manage.resources.byOwner', {
                owner: object.ownerShortname,
              })}
            </div>
          ) : null}
        </div>
        <div className="flex flex-row items-center gap-4">
          {!actionsDisabled && object.access === ObjectAccess.Public ? (
            <Button
              basic
              className={{
                root: twMerge(
                  'hover:text-primary-100 flex flex-row items-center gap-1.5',
                  object.access === ObjectAccess.Public && 'font-semibold'
                ),
              }}
              onClick={(e) => {
                e?.stopPropagation()
                setImportModal(true)
              }}
              data={{ cy: `import-object-${object.name}` }}
            >
              <FontAwesomeIcon icon={faCopy} />
              <div>{t('manage.catalog.importObject')}</div>
            </Button>
          ) : null}
          {!actionsDisabled && !object.isRequested ? (
            <Button
              basic
              className={{
                root: twMerge(
                  'hover:text-primary-100 flex flex-row items-center gap-1.5',
                  object.access === ObjectAccess.Restricted && 'font-semibold'
                ),
              }}
              onClick={(e) => {
                e?.stopPropagation()
                setRequestModal(true)
              }}
              data={{ cy: `request-access-${object.name}` }}
            >
              <FontAwesomeIcon icon={faHandPointer} />
              <div>{t('manage.catalog.requestAccess')}</div>
            </Button>
          ) : null}
          {object.isRequested ? (
            <>
              <div className="flex flex-row items-center gap-1.5">
                <FontAwesomeIcon icon={faClock} />
                <div>{t('manage.catalog.accessRequested')}</div>
              </div>
              <Button
                basic
                className={{
                  root: 'hover:text-primary-100 flex flex-row items-center gap-1.5',
                }}
                onClick={(e) => {
                  e?.stopPropagation()
                  setRequestCancellationModal(true)
                }}
                data={{ cy: `cancel-request-${object.name}` }}
              >
                <FontAwesomeIcon icon={faHandPointer} />
                <div>{t('manage.resources.cancelRequest')}</div>
              </Button>
            </>
          ) : null}
          {object.isShared ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} />
              <div>{t('manage.catalog.accessGranted')}</div>
            </div>
          ) : null}
          {managedAccess ? (
            <div className="flex flex-row gap-2">
              <ObjectAccessSelection
                compact
                value={object.access}
                onChange={(access) => {
                  setNewAccess(access as ObjectAccess)
                  setChangeAccessModal(true)
                }}
              />
              <Button
                onClick={(e) => {
                  e?.stopPropagation()
                  setRemovalModal(true)
                }}
                className={{ root: 'h-7' }}
                data={{ cy: `remove-object-${object.name}` }}
              >
                <FontAwesomeIcon icon={faX} className="text-red-600" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <ObjectAccessRequestModal
        object={object}
        open={requestModal}
        catalogCollectionId={catalogCollectionId}
        onClose={() => setRequestModal(false)}
      />
      <ObjectImportModal
        object={object}
        open={importModal}
        catalogCollectionId={catalogCollectionId}
        onClose={() => setImportModal(false)}
      />
      <ObjectRequestCancellationModal
        object={object}
        open={requestCancellationModal}
        catalogCollectionId={catalogCollectionId}
        onClose={() => setRequestCancellationModal(false)}
      />
      <ObjectChangeAccessModal
        object={object}
        newAccess={newAccess}
        open={changeAccessModal}
        catalogCollectionId={catalogCollectionId}
        onClose={() => setChangeAccessModal(false)}
      />
      <ObjectRemovalModal
        object={object}
        open={removalModal}
        catalogCollectionId={catalogCollectionId}
        onClose={() => setRemovalModal(false)}
      />
    </>
  )
}

export default CatalogObjectItem
