import { useMutation, useQuery } from '@apollo/client'
import { faClock, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faCheck,
  faHandPointer,
  faHourglassEnd,
  faHourglassStart,
  faLock,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteMicroLearningDocument,
  GetSingleCourseDocument,
  MicroLearning,
  PublicationStatus,
  UnpublishMicroLearningDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import CopyConfirmationToast from '../toasts/CopyConfirmationToast'
import { getAccessLink, getLTIAccessLink } from './PracticeQuizElement'
import StatusTag from './StatusTag'
import MicroLearningAccessLink from './actions/MicroLearningAccessLink'
import MicroLearningEvaluationLink from './actions/MicroLearningEvaluationLink'
import PublishMicroLearningButton from './actions/PublishMicroLearningButton'
import getActivityDuplicationAction from './actions/getActivityDuplicationAction'
import DeletionModal from './modals/DeletionModal'

interface MicroLearningElementProps {
  microLearning: Pick<
    MicroLearning,
    | 'id'
    | 'name'
    | 'status'
    | 'numOfStacks'
    | 'scheduledStartAt'
    | 'scheduledEndAt'
  >
  courseId: string
}

function MicroLearningElement({
  microLearning,
  courseId,
}: MicroLearningElementProps) {
  const t = useTranslations()
  const router = useRouter()
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}microlearning/${microLearning.id}/`
  const evaluationHref = `/course/${courseId}/microLearning/${microLearning.id}/evaluation`
  const isFuture = dayjs(microLearning.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(microLearning.scheduledEndAt).isBefore(dayjs())

  const [unpublishMicroLearning] = useMutation(UnpublishMicroLearningDocument, {
    variables: { id: microLearning.id },
  })

  const [deleteMicroLearning] = useMutation(DeleteMicroLearningDocument, {
    variables: { id: microLearning.id },
    optimisticResponse: {
      __typename: 'Mutation',
      deleteMicroLearning: {
        __typename: 'MicroLearning',
        id: microLearning.id,
      },
    },
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const statusMap: Record<PublicationStatus, React.ReactElement> = {
    [PublicationStatus.Draft]: (
      <StatusTag
        color="bg-gray-200"
        status={t('shared.generic.draft')}
        icon={faPencil}
      />
    ),
    [PublicationStatus.Published]: (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.published')}
        icon={isFuture ? faClock : isPast ? faCheck : faPlay}
      />
    ),
    [PublicationStatus.Scheduled]: <div />,
  }

  return (
    <div
      className="border-uzh-grey-80 flex w-full flex-row justify-between rounded border border-solid p-2"
      data-cy={`microlearning-${microLearning.name}`}
    >
      <div className="flex-1">
        <Ellipsis maxLength={50} className={{ markdown: 'font-bold' }}>
          {microLearning.name}
        </Ellipsis>

        <div className="mb-1 text-sm italic">
          {t('pwa.microLearning.numOfQuestionSets', {
            number: microLearning.numOfStacks,
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
      </div>

      <div className="flex flex-col items-end justify-between gap-4">
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
                  getAccessLink({
                    href,
                    setCopyToast,
                    t,
                    name: microLearning.name,
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: microLearning.name,
                      })
                    : [],
                  // {
                  //   label: (
                  //     <MicroLearningPreviewLink
                  //       microLearning={microLearning}
                  //       href={href}
                  //     />
                  //   ),
                  //   onClick: () => null,
                  // },
                  {
                    label: (
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                        <FontAwesomeIcon icon={faPencil} />
                        <div>{t('manage.course.editMicrolearning')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          elementId: microLearning.id,
                          editMode: WizardMode.Microlearning,
                        },
                      }),
                    data: { cy: `edit-microlearning-${microLearning.name}` },
                  },
                  getActivityDuplicationAction({
                    id: microLearning.id,
                    text: t('manage.course.duplicateMicroLearning'),
                    wizardMode: WizardMode.Microlearning,
                    router: router,
                    data: {
                      cy: `duplicate-microlearning-${microLearning.name}`,
                    },
                  }),
                  {
                    label: (
                      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
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
                ].flat()}
                triggerIcon={faHandPointer}
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
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: microLearning.name,
                      })
                    : [],
                  // {
                  //   label: (
                  //     <MicroLearningPreviewLink
                  //       microLearning={microLearning}
                  //       href={href}
                  //     />
                  //   ),
                  //   onClick: () => null,
                  // },
                  {
                    label: (
                      <MicroLearningEvaluationLink
                        quizName={microLearning.name}
                        evaluationHref={evaluationHref}
                      />
                    ),
                    onClick: () => null,
                  },
                  getActivityDuplicationAction({
                    id: microLearning.id,
                    text: t('manage.course.duplicateMicroLearning'),
                    wizardMode: WizardMode.Microlearning,
                    router: router,
                    data: {
                      cy: `duplicate-microlearning-${microLearning.name}`,
                    },
                  }),
                  ...(isFuture
                    ? [
                        {
                          label: (
                            <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
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
                  ...(isPast
                    ? [
                        {
                          label: (
                            <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                              <FontAwesomeIcon icon={faArrowsRotate} />
                              <div>
                                {t(
                                  'manage.course.convertMicroLearningToPracticeQuiz'
                                )}
                              </div>
                            </div>
                          ),
                          onClick: () =>
                            router.push({
                              pathname: '/',
                              query: {
                                elementId: microLearning.id,
                                conversionMode: 'microLearningToPracticeQuiz',
                              },
                            }),
                          data: {
                            cy: `convert-microlearning-${microLearning.name}-to-practice-quiz`,
                          },
                        },
                      ]
                    : []),
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}
        </div>
        <div className="flex flex-row gap-2">
          {statusMap[microLearning.status]}
        </div>
      </div>

      <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />
      <DeletionModal
        title={t('manage.course.deleteMicrolearning')}
        description={t('manage.course.confirmDeletionMicrolearning')}
        elementName={microLearning.name}
        message={t('manage.course.hintDeletionMicrolearning')}
        deleteElement={deleteMicroLearning}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-microlearning' }}
        secondaryData={{ cy: 'cancel-delete-microlearning' }}
      />
    </div>
  )
}

export default MicroLearningElement
