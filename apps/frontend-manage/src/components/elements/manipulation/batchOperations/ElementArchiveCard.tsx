import { faArchive, faInbox } from '@fortawesome/free-solid-svg-icons'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ElementBatchOperationActions,
  INITIAL_ELEMENT_BATCH_OPERATIONS,
} from '../types'

function ElementArchiveCard({
  selectedActions,
  setSelectedActions,
}: {
  selectedActions: ElementBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ElementBatchOperationActions>>
}) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3',
        (selectedActions.archive || selectedActions.unarchive) &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('shared.generic.archive')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
          <Button
            active={selectedActions.archive}
            onClick={() => {
              setSelectedActions((prev) => ({
                ...INITIAL_ELEMENT_BATCH_OPERATIONS,
                archive: !prev.archive,
                unarchive: false,
              }))
            }}
            className={{ root: 'h-8 flex-1 text-sm' }}
            data={{ cy: 'archive-button' }}
          >
            <Button.Icon icon={faArchive} />
            <Button.Label>
              {t('manage.questionPool.moveToArchive')}
            </Button.Label>
          </Button>
          <Button
            active={selectedActions.unarchive}
            onClick={() => {
              setSelectedActions((prev) => ({
                ...INITIAL_ELEMENT_BATCH_OPERATIONS,
                unarchive: !prev.unarchive,
                archive: false,
              }))
            }}
            className={{ root: 'h-8 flex-1 text-sm' }}
            data={{ cy: 'unarchive-button' }}
          >
            <Button.Icon icon={faInbox} />
            <Button.Label>
              {t('manage.questionPool.restoreFromArchive')}
            </Button.Label>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ElementArchiveCard
