import { useMutation } from '@apollo/client'
import { faClock, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faExternalLink,
  faHourglassEnd,
  faHourglassStart,
  faLink,
  faLock,
  faPencil,
  faPlay,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  MicroSession,
  MicroSessionStatus,
  UnpublishMicroSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import StatusTag from './StatusTag'
import MicroSessionDeletionModal from './modals/MicroSessionDeletionModal'
import PublishConfirmationModal from './modals/PublishConfirmationModal'

interface MicroSessionProps {
  microSession: Partial<MicroSession> & Pick<MicroSession, 'id' | 'name'>
}

function MicroSessionTile({ microSession }: MicroSessionProps) {
  const t = useTranslations()
  const router = useRouter()

  const [publishModal, setPublishModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const [unpublishMicroSession] = useMutation(UnpublishMicroSessionDocument, {
    variables: { id: microSession.id },
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/micro/${microSession.id}/`

  const isFuture = dayjs(microSession.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(microSession.scheduledEndAt).isBefore(dayjs())

  return (
    <div
      className="p-2 border border-solid rounded w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80"
      data-cy={`microlearning-${microSession.name}`}
    >
      <div className="flex flex-row items-center justify-between">
        <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
          {microSession.name || ''}
        </Ellipsis>

        {microSession.status === MicroSessionStatus.Draft && (
          <StatusTag
            color="bg-gray-200"
            status={t('shared.generic.draft')}
            icon={faPencil}
          />
        )}
        {microSession.status === MicroSessionStatus.Published && (
          <StatusTag
            color="bg-green-300"
            status={t('shared.generic.published')}
            icon={isFuture ? faClock : isPast ? faCheck : faPlay}
          />
        )}
      </div>
      <div className="mb-1 italic">
        {t('manage.course.nQuestions', {
          number: microSession.numOfInstances || '0',
        })}
      </div>
      <div className="flex flex-row items-center gap-2">
        <FontAwesomeIcon icon={faHourglassStart} />
        <div>
          {t('manage.course.startAt', {
            time: dayjs(microSession.scheduledStartAt)
              .local()
              .format('DD.MM.YYYY, HH:mm'),
          })}
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <FontAwesomeIcon icon={faHourglassEnd} />
        <div>
          {t('manage.course.endAt', {
            time: dayjs(microSession.scheduledEndAt)
              .local()
              .format('DD.MM.YYYY, HH:mm'),
          })}
        </div>
      </div>
      <Button
        basic
        onClick={() => {
          try {
            navigator.clipboard.writeText(href)
            setCopyToast(true)
          } catch (e) {}
        }}
        className={{
          root: twMerge('flex flex-row items-center gap-1 text-primary'),
        }}
        data={{ cy: `copy-microlearning-link-${microSession.name}` }}
      >
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>{t('manage.course.copyAccessLink')}</div>
      </Button>
      <Link href={href} target="_blank">
        <Button
          basic
          className={{
            root: 'flex flex-row items-center gap-1 text-primary',
          }}
          data={{ cy: `open-microlearning-${microSession.name}` }}
        >
          <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
          <div>{t('shared.generic.open')}</div>
        </Button>
      </Link>
      {microSession.status === MicroSessionStatus.Draft && (
        <Button
          basic
          className={{ root: 'text-primary' }}
          onClick={() =>
            router.push({
              pathname: '/',
              query: {
                sessionId: microSession.id,
                editMode: 'microSession',
              },
            })
          }
          data={{ cy: `edit-microlearning-${microSession.name}` }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faPencil} />
          </Button.Icon>
          <Button.Label>{t('manage.course.editMicroSession')}</Button.Label>
        </Button>
      )}

      {microSession.status === MicroSessionStatus.Draft && (
        <Button
          basic
          className={{ root: 'text-primary' }}
          onClick={() => setPublishModal(true)}
          data={{ cy: `publish-microlearning-${microSession.name}` }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
          </Button.Icon>
          <Button.Label>{t('manage.course.publishMicroSession')}</Button.Label>
        </Button>
      )}

      {microSession.status === MicroSessionStatus.Draft && (
        <Button
          basic
          className={{ root: 'text-red-600' }}
          onClick={() => setDeletionModal(true)}
          data={{ cy: `delete-microlearning-${microSession.name}` }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
          </Button.Icon>
          <Button.Label>{t('manage.course.deleteMicroSession')}</Button.Label>
        </Button>
      )}

      {microSession.status === MicroSessionStatus.Published && isFuture && (
        <Button
          basic
          className={{ root: 'text-primary' }}
          onClick={async () => await unpublishMicroSession()}
          data={{ cy: `unpublish-microlearning-${microSession.name}` }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />
          </Button.Icon>
          <Button.Label>
            {t('manage.course.unpublishMicroSession')}
          </Button.Label>
        </Button>
      )}

      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkMicroSessionCopied')}
      </Toast>
      <PublishConfirmationModal
        elementType={ElementInstanceType.Microlearning}
        elementId={microSession.id}
        title={microSession.name}
        open={publishModal}
        setOpen={setPublishModal}
      />
      <MicroSessionDeletionModal
        sessionId={microSession.id}
        title={microSession.name}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </div>
  )
}

export default MicroSessionTile
