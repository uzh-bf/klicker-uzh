import { useLazyQuery, useQuery } from '@apollo/client'
import {
  Element,
  GetAnswerCollectionDownloadLinkDocument,
  GetAnswerCollectionsInfoBasicDocument,
  GetElementDownloadLinkDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H4, Modal, Select, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { RefObject, useState } from 'react'
import SelectedElementsList from './batchOperations/SelectedElementsList'

async function createDownload(downloadLink: string, filename: string) {
  const response = await fetch(downloadLink)
  if (!response.ok) throw new Error('Failed to fetch download link.')

  const json = await response.json()
  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: 'application/json',
  })
  const blobUrl = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

const DownloadSelectedElements: React.FC<{
  selectedElements: Element[]
  seenElementIds: RefObject<Record<string, string>>
  filename?: string
}> = ({ selectedElements, seenElementIds, filename = 'elements.json' }) => {
  const [fetchDownloadLink, { loading, error }] = useLazyQuery(
    GetElementDownloadLinkDocument
  )

  const [localError, setLocalError] = useState<string | null>(null)
  const selectedElementIds = selectedElements.map((element) => element.id)

  const handleDownload = async () => {
    try {
      // get download link (unique for element-id+version combinations)
      const elementsIdentifier = selectedElements
        .sort((a, b) => a.id - b.id)
        .map((element) => `${element.id}:${element.version}`)
        .join('-')

      const exists = !!seenElementIds.current[elementsIdentifier]
      const downloadLink = exists
        ? seenElementIds.current[elementsIdentifier]
        : await fetchDownloadLink({
            variables: { elementIds: selectedElementIds },
            fetchPolicy: 'network-only',
          }).then((result) => result.data?.getElementDownloadLink?.downloadLink)

      if (!downloadLink) {
        throw new Error('No download link received.')
      }
      seenElementIds.current[elementsIdentifier] = downloadLink

      // create download
      await createDownload(downloadLink, filename)
    } catch (err: any) {
      setLocalError(err.message ?? 'Failed to download elements.')
    }
  }

  const disableDownload = loading || selectedElementIds.length === 0
  return (
    <Button
      className={{ root: 'w-[80%]' }}
      onClick={() => {
        handleDownload()
        if (error || localError) {
          const errorMessage =
            error?.message ?? localError ?? 'Failed to download elements.'
          toast({
            options: {
              description: errorMessage,
            },
            type: 'error',
          })
        }
      }}
      disabled={disableDownload}
    >
      Download
    </Button>
  )
}

const DownloadSelectedAnswerCollection: React.FC<{
  selectedAnswerCollectionId: number
  selectedAnswerCollectionVersion: number | null | undefined
  seenAnswerCollections: RefObject<Record<string, string>>
  answerCollectionsLoading: boolean
  filename?: string
}> = ({
  selectedAnswerCollectionId,
  selectedAnswerCollectionVersion,
  seenAnswerCollections,
  answerCollectionsLoading,
  filename = 'answercollection.json',
}) => {
  const [fetchDownloadLink, { loading: downloadLinkLoading, error }] =
    useLazyQuery(GetAnswerCollectionDownloadLinkDocument)

  const [localError, setLocalError] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      // get download link (unique for element-id+version combinations)
      if (selectedAnswerCollectionId === -1) {
        throw new Error('No answer collection selected.')
      }
      if (!selectedAnswerCollectionVersion) {
        throw new Error(
          'No version information available for selected answer collection.'
        )
      }
      const answerCollectionIdentifier = `${selectedAnswerCollectionId}:${selectedAnswerCollectionVersion}`

      const exists = !!seenAnswerCollections.current[answerCollectionIdentifier]
      const downloadLink = exists
        ? seenAnswerCollections.current[answerCollectionIdentifier]
        : await fetchDownloadLink({
            variables: { answerCollectionId: selectedAnswerCollectionId },
          }).then(
            (result) =>
              result.data?.getAnswerCollectionDownloadLink?.downloadLink
          )

      if (!downloadLink) {
        throw new Error('No download link received')
      }
      seenAnswerCollections.current[answerCollectionIdentifier] = downloadLink

      // create download
      await createDownload(downloadLink, filename)
    } catch (err: any) {
      setLocalError(err.message ?? 'Failed to download answer collection.')
    }
  }

  const disableDownload =
    answerCollectionsLoading ||
    downloadLinkLoading ||
    selectedAnswerCollectionId === -1
  return (
    <Button
      className={{ root: 'w-[80%]' }}
      onClick={() => {
        handleDownload()
        if (error || localError) {
          const errorMessage =
            error?.message ??
            localError ??
            'Failed to download answer collection.'
          toast({
            options: {
              description: errorMessage,
            },
            type: 'error',
          })
        }
      }}
      disabled={disableDownload}
    >
      Download
    </Button>
  )
}

function DownloadModal({
  selectedElements,
  seenElementIds,
  seenAnswerCollections,
  onClose,
}: {
  selectedElements: Element[]
  seenElementIds: RefObject<Record<string, string>>
  seenAnswerCollections: RefObject<Record<string, string>>
  onClose: () => void
}) {
  const t = useTranslations()

  // elements
  const [affectedElements, setAffectedElements] = useState(
    selectedElements.map((element) => ({
      ...element,
      actionsApplied: true,
      reasons: [] as string[],
    }))
  )

  // answer collections
  const [selectedCollectionId, setSelectedCollectionId] = useState<number>(-1)
  const { data: answerCollectionsData, loading: answerCollectionsLoading } =
    useQuery(GetAnswerCollectionsInfoBasicDocument)
  const collections = answerCollectionsData?.getAnswerCollectionsInfoBasic ?? []
  const collectionsSorted = [...collections].sort((a, b) =>
    a.id < b.id ? -1 : 1
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('shared.generic.download')}
      className={{
        content:
          'xl:w-220 h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-scroll',
      }}
      dataCloseButton={{ cy: 'close-element-download-modal' }}
    >
      <div className="flex h-auto min-h-0 flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
        <div className="flex h-max max-h-full min-h-0 w-full flex-1 flex-row gap-4 divide-x">
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col">
              <H4>{t('shared.generic.elements')}</H4>
              <div className="text-sm">
                {t('manage.questionPool.selectedElementsDescriptionDownload', {
                  numElements: selectedElements.length,
                })}
              </div>
              <div className="mr-4">
                <SelectedElementsList
                  selectedElements={selectedElements}
                  affectedElements={affectedElements}
                />
              </div>
              <div className="m-4 flex justify-end">
                <DownloadSelectedElements
                  selectedElements={selectedElements}
                  seenElementIds={seenElementIds}
                />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-1 flex-col">
            <H4>{t('shared.generic.answerCollection')}</H4>
            <Select
              placeholder={t('manage.elements.selectCollection')}
              items={collectionsSorted.map((collection) => ({
                label: `${collection.name} (${collection.numOfEntries ?? 0} ${t('shared.generic.entries')})`,
                value: String(collection.id),
                data: {
                  cy: `select-answer-collection-${collection.name}`,
                },
              }))}
              onChange={(value) => setSelectedCollectionId(Number(value))}
              data={{ cy: 'select-answer-collection' }}
            />
            <div className="m-4 flex justify-end">
              <DownloadSelectedAnswerCollection
                selectedAnswerCollectionId={Number(selectedCollectionId)}
                selectedAnswerCollectionVersion={
                  collections.find((c) => c.id === Number(selectedCollectionId))
                    ?.version
                }
                seenAnswerCollections={seenAnswerCollections}
                answerCollectionsLoading={answerCollectionsLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default DownloadModal
