import { useMutation } from '@apollo/client'
import { WizardMode } from '@components/sessions/creation/SessionCreation'
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
  MicroLearning,
  MicroLearningStatus,
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

interface MicroLearningElementProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function MicroSessionTile({ microLearning }: MicroLearningElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [publishModal, setPublishModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const [unpublishMicroSession] = useMutation(UnpublishMicroSessionDocument, {
    variables: { id: microLearning.id },
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/micro/${microLearning.id}/`

  const isFuture = dayjs(microLearning.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(microLearning.scheduledEndAt).isBefore(dayjs())

  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`microlearning-${microLearning.name}`}
    >
      <div className="flex flex-row items-center justify-between">
        <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
          {microLearning.name || ''}
        </Ellipsis>

        <div className="flex flex-row items-center gap-3 text-sm">
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
            data={{ cy: `copy-microlearning-link-${microLearning.name}` }}
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
              data={{ cy: `open-microlearning-${microLearning.name}` }}
            >
              <FontAwesomeIcon
                icon={faExternalLink}
                size="sm"
                className="w-4"
              />
              <div>{t('shared.generic.open')}</div>
            </Button>
          </Link>
          {microLearning.status === MicroLearningStatus.Draft && (
            <Button
              basic
              className={{ root: 'text-primary' }}
              onClick={() =>
                router.push({
                  pathname: '/',
                  query: {
                    sessionId: microLearning.id,
                    editMode: WizardMode.Microlearning,
                  },
                })
              }
              data={{ cy: `edit-microlearning-${microLearning.name}` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPencil} />
              </Button.Icon>
              <Button.Label>
                {t('manage.course.editMicrolearning')}
              </Button.Label>
            </Button>
          )}

          {microLearning.status === MicroLearningStatus.Draft && (
            <Button
              basic
              className={{ root: 'text-primary' }}
              onClick={() => setPublishModal(true)}
              data={{ cy: `publish-microlearning-${microLearning.name}` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
              </Button.Icon>
              <Button.Label>
                {t('manage.course.publishMicrolearning')}
              </Button.Label>
            </Button>
          )}

          {microLearning.status === MicroLearningStatus.Draft && (
            <Button
              basic
              className={{ root: 'text-red-600' }}
              onClick={() => setDeletionModal(true)}
              data={{ cy: `delete-microlearning-${microLearning.name}` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
              </Button.Icon>
              <Button.Label>
                {t('manage.course.deleteMicrolearning')}
              </Button.Label>
            </Button>
          )}

          {microLearning.status === MicroLearningStatus.Published &&
            isFuture && (
              <Button
                basic
                className={{ root: 'text-primary' }}
                onClick={async () => await unpublishMicroSession()}
                data={{ cy: `unpublish-microlearning-${microLearning.name}` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />
                </Button.Icon>
                <Button.Label>
                  {t('manage.course.unpublishMicrolearning')}
                </Button.Label>
              </Button>
            )}

          {microLearning.status === MicroLearningStatus.Draft && (
            <StatusTag
              color="bg-gray-200"
              status={t('shared.generic.draft')}
              icon={faPencil}
            />
          )}
          {microLearning.status === MicroLearningStatus.Published && (
            <StatusTag
              color="bg-green-300"
              status={t('shared.generic.published')}
              icon={isFuture ? faClock : isPast ? faCheck : faPlay}
            />
          )}
        </div>
      </div>
      <div className="mb-1 text-sm italic">
        {t('pwa.microSession.numOfQuestionSets', {
          number: microLearning.numOfStacks || '0',
        })}
      </div>
      <div className="flex flex-row gap-4 text-sm">
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassStart} />
          <div>
            {t('manage.course.startAt', {
              time: dayjs(microLearning.scheduledStartAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassEnd} />
          <div>
            {t('manage.course.endAt', {
              time: dayjs(microLearning.scheduledEndAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
      </div>

      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkMicrolearningCopied')}
      </Toast>
      <PublishConfirmationModal
        elementType={ElementInstanceType.Microlearning}
        elementId={microLearning.id}
        title={microLearning.name}
        open={publishModal}
        setOpen={setPublishModal}
      />
      <MicroSessionDeletionModal
        sessionId={microLearning.id}
        title={microLearning.name}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </div>
  )
}

export default MicroSessionTile
