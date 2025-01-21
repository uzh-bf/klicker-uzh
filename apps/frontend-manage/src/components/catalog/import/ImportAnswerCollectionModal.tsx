import { useQuery } from '@apollo/client'
import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleAnswerCollectionCatalogDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function ImportAnswerCollectionModal({
  id,
  open,
  onClose,
  onSuccess,
}: {
  id: number
  open: boolean
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
    },
  })

  // TODO: implement with validation, etc.
  //   const [importAnswerCollection, { loading: importLoading }] = useMutation(
  //       ImportAnswerCollectionDocument,
  //       {
  //         variables: { collectionId: collection.id },
  //         update: (cache, { data }) => {
  //           if (!data?.importAnswerCollection) return
  //           const newCollection = data.importAnswerCollection

  //           // update lists of answer collections
  //           const collectionsListQuery = cache.readQuery({
  //             query: GetAnswerCollectionsDocument,
  //           })
  //           const collections = collectionsListQuery?.getAnswerCollections

  //           if (collections) {
  //             cache.writeQuery({
  //               query: GetAnswerCollectionsDocument,
  //               data: {
  //                 getAnswerCollections: [...collections, newCollection],
  //               },
  //             })
  //           }

  //           // update list of collections available for selection
  //           // TODO: do not show imported objects in selection
  //         },
  //       }
  //     )

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
                  className={{ root: 'text-primary-100' }}
                  onClick={() => setShowEntries(true)}
                  data={{ cy: 'public-collection-show-answers' }}
                >
                  {t('manage.resources.showAnswers')}
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-row justify-between">
            <Button
              className={{ root: 'h-8 border-red-600 text-base' }}
              data={{ cy: 'cancel-answer-collection-import' }}
              onClick={(e) => {
                e?.stopPropagation()
                setShowEntries(false)
                onClose()
              }}
            >
              <FontAwesomeIcon icon={faBan} />
              {t('shared.generic.cancel')}
            </Button>
            <Button
              className={{ root: 'border-primary-80 h-8 text-base' }}
              onClick={async (e) => {
                e?.stopPropagation()
                // TODO: implement on click logic to request answer collection -> verify access to catalogue collection, then check remaining things as before, update cache
                // const res = await importAnswerCollection()
                // if (res.data?.importAnswerCollection) {
                //   onSuccess()
                //   onClose()
                // } else {
                //   setError(true)
                // }
              }}
              //   loading={loadingImport} // TODO: re-introduce
              data={{ cy: 'confirm-answer-collection-import' }}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              {t('manage.resources.importCollection')}
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
