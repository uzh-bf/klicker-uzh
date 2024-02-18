import { useMutation } from '@apollo/client'
import { WizardMode } from '@components/sessions/creation/SessionCreation'
import { faClock, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faHandPointer,
  faHourglassEnd,
  faHourglassStart,
  faLink,
  faLock,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MicroLearning,
  PublicationStatus,
  UnpublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown, Toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import MicroLearningAccessLink from './actions/MicroLearningAccessLink'
import MicroLearningPreviewLink from './actions/MicroLearningPreviewLink'
import PublishMicroLearningButton from './actions/PublishMicroLearningButton'
import MicroLearningDeletionModal from './modals/MicroLearningDeletionModal'

interface MicroLearningElementProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function MicroSessionTile({ microLearning }: MicroLearningElementProps) {
  const t = useTranslations()
  const router = useRouter()
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/microlearning/${microLearning.id}/`
  const isFuture = dayjs(microLearning.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(microLearning.scheduledEndAt).isBefore(dayjs())

  const [unpublishMicroLearning] = useMutation(UnpublishMicroLearningDocument, {
    variables: { id: microLearning.id },
  })

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
          {microLearning.status === PublicationStatus.Draft && (
            <>
              <PublishMicroLearningButton microLearning={microLearning} />
              <Dropdown
                data={{ cy: `microlearning-actions-${microLearning.name}` }}
                className={{
                  item: 'p-1 hover:bg-gray-200',
                  viewport: 'bg-white',
                }}
                trigger={t('manage.course.otherActions')}
                items={[
                  {
                    label: (
                      <div className="flex flex-row text-primary items-center gap-1 cursor-pointer">
                        <FontAwesomeIcon
                          icon={faLink}
                          size="sm"
                          className="w-4"
                        />
                        <div>{t('manage.course.copyAccessLink')}</div>
                      </div>
                    ),
                    onClick: () => {
                      try {
                        navigator.clipboard.writeText(href)
                        setCopyToast(true)
                      } catch (e) {}
                    },
                    data: {
                      cy: `copy-microlearning-link-${microLearning.name}`,
                    },
                  },
                  {
                    label: (
                      <MicroLearningPreviewLink
                        microLearning={microLearning}
                        href={href}
                      />
                    ),
                    onClick: () => null,
                  },
                  {
                    label: (
                      <div className="flex flex-row text-primary items-center gap-1 cursor-pointer">
                        <FontAwesomeIcon icon={faPencil} />
                        <div>{t('manage.course.editMicrolearning')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          sessionId: microLearning.id,
                          editMode: WizardMode.Microlearning,
                        },
                      }),
                    data: { cy: `edit-microlearning-${microLearning.name}` },
                  },
                  {
                    label: (
                      <div className="flex flex-row text-red-600 items-center gap-1 cursor-pointer">
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="w-[1.1rem]"
                        />
                        <div>{t('manage.course.deleteMicrolearning')}</div>
                      </div>
                    ),
                    onClick: () => setDeletionModal(true),
                    data: { cy: `delete-microlearning-${microLearning.name}` },
                  },
                ]}
                triggerIcon={faHandPointer}
              />
              <StatusTag
                color="bg-gray-200"
                status={t('shared.generic.draft')}
                icon={faPencil}
              />
            </>
          )}

          {microLearning.status === PublicationStatus.Published && (
            <>
              <MicroLearningAccessLink
                microLearning={microLearning}
                href={href}
              />
              <Dropdown
                data={{ cy: `microlearning-actions-${microLearning.name}` }}
                className={{
                  item: 'p-1 hover:bg-gray-200',
                  viewport: 'bg-white',
                }}
                trigger={t('manage.course.otherActions')}
                items={[
                  {
                    label: (
                      <MicroLearningPreviewLink
                        microLearning={microLearning}
                        href={href}
                      />
                    ),
                    onClick: () => null,
                  },
                  ...(isFuture
                    ? [
                        {
                          label: (
                            <div className="flex flex-row text-red-600 items-center gap-1 cursor-pointer">
                              <FontAwesomeIcon
                                icon={faLock}
                                className="w-[1.1rem]"
                              />

                              <div>
                                {t('manage.course.unpublishMicrolearning')}
                              </div>
                            </div>
                          ),
                          onClick: async () => await unpublishMicroLearning(),
                          data: {
                            cy: `unpublish-microlearning-${microLearning.name}`,
                          },
                        },
                      ]
                    : []),
                ]}
                triggerIcon={faHandPointer}
              />
              <StatusTag
                color="bg-green-300"
                status={t('shared.generic.published')}
                icon={isFuture ? faClock : isPast ? faCheck : faPlay}
              />
            </>
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
      <MicroLearningDeletionModal
        sessionId={microLearning.id}
        title={microLearning.name}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </div>
  )
}

export default MicroSessionTile
