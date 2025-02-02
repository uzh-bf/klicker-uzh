import { faClock, faCopy, faHand } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faList,
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
import ObjectAccessLabel from '../ObjectAccessLabel'
import ObjectAccessRequestModal from './ObjectAccessRequestModal'
import ObjectImportModal from './ObjectImportModal'

function CatalogObjectItem({ object }: { object: CatalogObject }) {
  const t = useTranslations()
  const objectTypeIcons: Record<CatalogObjectType, IconDefinition> = {
    [CatalogObjectType.AnswerCollection]: faList,
  }

  const actionsDisabled = object.isOwner || object.isShared
  const [requestModal, setRequestModal] = useState(false)
  const [importModal, setImportModal] = useState(false)

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
              <FontAwesomeIcon icon={faHand} />
              <div>{t('manage.catalog.requestAccess')}</div>
            </Button>
          ) : null}
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
        </div>
      </div>
      <ObjectAccessRequestModal
        object={object}
        open={requestModal}
        onClose={() => setRequestModal(false)}
      />
      <ObjectImportModal
        object={object}
        open={importModal}
        onClose={() => setImportModal(false)}
      />
    </>
  )
}

export default CatalogObjectItem
