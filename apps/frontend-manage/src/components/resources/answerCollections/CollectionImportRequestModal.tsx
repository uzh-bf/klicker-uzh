import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan, faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  CollectionAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function CollectionImportRequestModal({
  open,
  collection,
  onClose,
  onSuccess,
}: {
  open: boolean
  collection: AnswerCollection
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [showEntries, setShowEntries] = useState(false)
  const publicCollection = collection.access === CollectionAccess.Public

  // TODO: implement mutations
  const importAnswerCollection = async () => null
  const requestAnswerCollection = async () => null

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        setShowEntries(false)
      }}
      title={t('manage.resources.requestImportCollection')}
    >
      <div>
        {collection.access === CollectionAccess.Restricted
          ? t.rich('manage.resources.requestAccessMessage', {
              name: collection.name,
              b: (text) => <b>{text}</b>,
            })
          : t.rich('manage.resources.importCollectionMessage', {
              name: collection.name,
              b: (text) => <b>{text}</b>,
            })}
      </div>
      <div className="border-uzh-grey-100 mt-2 rounded border border-solid p-2">
        <div className="flex flex-row items-end gap-2">
          <H3 className={{ root: 'mb-0' }}>{collection.name}</H3>
          <div className="mb-[0.16rem] text-sm text-gray-500">
            {t('manage.resources.byOwner', {
              owner: collection.ownerShortname,
            })}
          </div>
        </div>
        <Markdown content={`**Description:** ${collection.description}`} />
        {publicCollection &&
        collection.entries &&
        collection.entries.length > 0 ? (
          <div>
            {showEntries ? (
              <div className="mt-2">
                <div className="font-bold">
                  {t('manage.resources.answerOptions')}
                </div>
                <ul className="list-inside list-disc">
                  {collection.entries.map((entry) => (
                    <li key={entry.id}>{entry.value}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <Button
                basic
                className={{ root: 'text-primary-100' }}
                onClick={() => setShowEntries(true)}
              >
                {t('manage.resources.showAnswers')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-row justify-between">
        <Button className={{ root: 'h-8 border-red-600' }}>
          <FontAwesomeIcon icon={faBan} />
          {t('shared.generic.cancel')}
        </Button>
        <Button
          className={{ root: 'border-primary-80 h-8' }}
          onClick={() =>
            publicCollection
              ? importAnswerCollection()
              : requestAnswerCollection()
          }
        >
          <FontAwesomeIcon
            icon={publicCollection ? faDownload : faPaperPlane}
          />
          {publicCollection
            ? t('manage.resources.importCollection')
            : t('manage.resources.requestAccess')}
        </Button>
      </div>
    </Modal>
  )
}

export default CollectionImportRequestModal
