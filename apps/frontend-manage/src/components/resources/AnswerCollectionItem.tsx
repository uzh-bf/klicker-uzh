import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import {
  faLock,
  faLockOpen,
  faUserLock,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  CollectionAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function AnswerCollectionItem({
  collection,
  editable,
}: {
  collection: AnswerCollection
  editable: boolean
}) {
  const t = useTranslations()
  const [editModal, setEditModal] = useState(false)
  const collectionAccessMap: Record<CollectionAccess, React.ReactNode> = {
    [CollectionAccess.Private]: (
      <div className="flex flex-row items-center gap-1.5 text-sm text-red-700">
        <FontAwesomeIcon icon={faLock} />
        {t(`manage.resources.access${CollectionAccess.Private}`)}
      </div>
    ),
    [CollectionAccess.Public]: (
      <div className="flex flex-row items-center gap-1.5 text-sm text-green-700">
        <FontAwesomeIcon icon={faLockOpen} />
        {t(`manage.resources.access${CollectionAccess.Public}`)}
      </div>
    ),
    [CollectionAccess.Restricted]: (
      <div className="flex flex-row items-center gap-1.5 text-sm text-orange-600">
        <FontAwesomeIcon icon={faUserLock} />
        {t(`manage.resources.access${CollectionAccess.Restricted}`)}
      </div>
    ),
  }

  return (
    <>
      <Button
        basic
        onClick={editable ? () => setEditModal(true) : undefined}
        className={{
          root: 'flex flex-row justify-between rounded border border-solid px-2 py-0.5 shadow-sm',
        }}
      >
        <div className="flex flex-col items-start">
          <div className="flex flex-row gap-5">
            <H4 className={{ root: 'mb-0' }}>{collection.name}</H4>
            {editable ? (
              collectionAccessMap[collection.access]
            ) : (
              <div className="text-xs text-gray-500">
                {t('manage.resources.byOwner', {
                  owner: collection.ownerShortname,
                })}
              </div>
            )}
          </div>
          {typeof collection.entries !== 'undefined' &&
          collection.entries !== null ? (
            <div className="text-sm text-gray-500">
              {t('manage.resources.numOfAnswers', {
                number: collection.entries!.length ?? 0,
              })}
            </div>
          ) : null}
        </div>
        {editable ? (
          <div className="flex flex-row items-center gap-1.5 self-end text-sm">
            <FontAwesomeIcon icon={faHandPointer} />
            <div>{t('manage.resources.clickToViewEdit')}</div>
          </div>
        ) : (
          <div>VIEW SHARED CONTENT</div>
        )}
      </Button>
    </>
  )
}

export default AnswerCollectionItem
