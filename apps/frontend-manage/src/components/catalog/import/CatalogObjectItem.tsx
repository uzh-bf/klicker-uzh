import { faClock, faCopy, faHand } from '@fortawesome/free-regular-svg-icons'
import { faList, IconDefinition } from '@fortawesome/free-solid-svg-icons'
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

  const actionsDisabled = !object.isOwner && !object.isSharedOrRequested
  const [requestModal, setRequestModal] = useState(false)
  const [importModal, setImportModal] = useState(false)

  return (
    <div
      className="flex flex-row items-center justify-between border-b border-solid px-1 py-1 text-sm hover:bg-slate-100"
      onClick={() => {
        if (actionsDisabled) return

        object.access === ObjectAccess.Public
          ? setImportModal(true)
          : setRequestModal(true)
      }}
    >
      <div className="flex flex-row items-center gap-2">
        <ObjectAccessLabel
          iconOnly
          accessType={object.access}
          className="mr-2 w-3 text-sm"
        />
        <FontAwesomeIcon icon={objectTypeIcons[object.objectType]} size="sm" />
        <div>{object.name}</div>
        {object.ownerShortname ? (
          <div className="text-xs text-slate-500">
            {t('manage.resources.byOwner', {
              owner: object.ownerShortname,
            })}
          </div>
        ) : null}
      </div>
      {actionsDisabled ? (
        <div className="flex flex-row items-center gap-4">
          {object.access === ObjectAccess.Public ? (
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
            >
              <FontAwesomeIcon icon={faCopy} />
              <div>{t('manage.catalog.importObject')}</div>
            </Button>
          ) : null}
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
          >
            <FontAwesomeIcon icon={faHand} />
            <div>{t('manage.catalog.requestAccess')}</div>
          </Button>
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
        </div>
      ) : null}
      {object.isSharedOrRequested ? (
        <div className="flex flex-row">
          <FontAwesomeIcon icon={faClock} />
          <div>{t('manage.catalog.accessRequested')}</div>
        </div>
      ) : null}
    </div>
  )
}

export default CatalogObjectItem
