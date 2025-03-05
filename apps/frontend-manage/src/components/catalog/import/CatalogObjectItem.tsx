import { faClock, faFolder } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faEllipsisVertical,
  faList,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  CatalogObjectType,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useCatalogObjectActionsDropdown from '../../../lib/hooks/useCatalogObjectActionsDropdown'
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
    [CatalogObjectType.CatalogCollection]: faFolder,
  }

  const actionsDisabled = object.isOwner || object.isShared
  const [requestModal, setRequestModal] = useState(false)
  const [requestCancellationModal, setRequestCancellationModal] =
    useState(false)
  const [importModal, setImportModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(object.access)

  // Use the new dropdown hook
  const dropdownItems = useCatalogObjectActionsDropdown({
    object,
    actionsDisabled,
    managedAccess,
    setImportModal,
    setRequestModal,
    setRequestCancellationModal,
    setRemovalModal,
  })

  return (
    <>
      <div
        className="flex h-9 flex-row items-center justify-between border-b border-solid px-1 text-sm hover:cursor-pointer hover:bg-slate-100"
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
            className="w-4"
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
        <div
          className={twMerge(
            'flex flex-row items-center gap-2',
            dropdownItems.length === 0 && 'mr-9'
          )}
        >
          {object.isRequested ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} />
              <div>{t('manage.catalog.accessRequested')}</div>
            </div>
          ) : null}
          {object.isShared ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} />
              <div>{t('manage.catalog.accessGranted')}</div>
            </div>
          ) : null}

          {managedAccess ? (
            <div className="ml-2">
              <ObjectAccessSelection
                compact
                value={object.access}
                onChange={(access) => {
                  setNewAccess(access as ObjectAccess)
                  setChangeAccessModal(true)
                }}
                cyPrefix={object.name}
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
              data={{ cy: `actions-dropdown-${object.name}` }}
            />
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
