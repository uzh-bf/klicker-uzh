import { useMutation, useQuery } from '@apollo/client'
import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import {
  GetSingleAnswerCollectionCatalogDocument,
  ImportAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function ImportAnswerCollectionModal({
  id,
  open,
  catalogCollectionId,
  onClose,
  onSuccess,
}: {
  id: number
  open: boolean
  catalogCollectionId?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [showError, setShowError] = useState(false)
  const [showEntries, setShowEntries] = useState(false)

  // fetch answer collection
  const { data, loading } = useQuery(GetSingleAnswerCollectionCatalogDocument, {
    variables: {
      collectionId: id,
      catalogCollectionId,
    },
  })

  const [importAnswerCollection, { loading: importLoading }] = useMutation(
    ImportAnswerCollectionDocument,
    {
      variables: { collectionId: id, catalogCollectionId },
    }
  )

  const collection = data?.getSingleAnswerCollectionCatalog

  return (
    <Modal
      open={open}
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
        setShowEntries(false)
      }}
      title={t('manage.catalog.importPublicResource')}
      className={{ content: 'text-sm' }}
      dataCloseButton={{ cy: 'close-answer-collection-import-modal' }}
    >
      {loading || !collection ? (
        <Loader />
      ) : (
        <>
          <div>
            {t.rich('manage.resources.importCollectionMessage', {
              name: collection.name,
              owner: collection.ownerShortname,
              b: (text) => <b>{text}</b>,
            })}
          </div>
          <div className="border-uzh-grey-100 mt-2 rounded border border-solid bg-slate-100 p-2">
            <Markdown
              content={`**Description:** ${collection.description}`}
              data={{ cy: 'import-answer-collection-description' }}
            />
            <div>
              {showEntries ? (
                <div className="mt-2">
                  <div className="font-bold">
                    {t('manage.resources.answerOptions')}
                  </div>
                  <ul className="list-inside list-disc">
                    {collection.entries?.map((entry, ix) => (
                      <li
                        key={entry.id}
                        data-cy={`public-collection-answer-option-${ix}`}
                      >
                        {entry.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Button
                  basic
                  className={{
                    root: 'text-primary-100 px-0 py-0 hover:bg-transparent',
                  }}
                  onClick={() => setShowEntries(true)}
                  data={{ cy: 'public-collection-show-answers' }}
                >
                  <Button.Label>
                    {t('manage.resources.showAnswers')}
                  </Button.Label>
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-row justify-between">
            <Button
              className={{ root: 'h-8 border-red-600 py-0' }}
              data={{ cy: 'cancel-answer-collection-import' }}
              onClick={(e) => {
                e?.stopPropagation()
                setShowEntries(false)
                onClose()
              }}
            >
              <Button.Icon icon={faBan} />
              <Button.Label>{t('shared.generic.cancel')}</Button.Label>
            </Button>
            <Button
              primary
              className={{ root: 'h-8 py-0' }}
              onClick={async (e) => {
                e?.stopPropagation()
                const res = await importAnswerCollection()
                if (res.data?.importAnswerCollection) {
                  onSuccess()
                  onClose()
                } else {
                  setShowError(true)
                }
              }}
              loading={importLoading}
              data={{ cy: 'confirm-answer-collection-import' }}
            >
              <Button.Icon icon={faPaperPlane} />
              <Button.Label>
                {t('manage.resources.importCollection')}
              </Button.Label>
            </Button>
          </div>
          <Toast
            openExternal={showError}
            onCloseExternal={() => setShowError(false)}
          >
            {t('manage.resources.importError')}
          </Toast>
        </>
      )}
    </Modal>
  )
}

export default ImportAnswerCollectionModal
