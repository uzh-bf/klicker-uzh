import { useMutation, useQuery } from '@apollo/client'
import { faClock, faFileLines } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faLock,
  faPencil,
  faPlay,
  faTrashCan,
  faTrophy,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  DeleteLiveQuizDocument,
  GetSingleCourseDocument,
  LiveQuiz,
  LiveQuizAccessMode,
  PublicationStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import ActivityActionsTrigger from './ActivityActionsTrigger'
import { getAccessLink, getLTIAccessLink } from './PracticeQuizElement'
import StatusTag from './StatusTag'
import EvaluationLinkLiveQuiz from './actions/EvaluationLinkLiveQuiz'
import RunningLiveQuizLink from './actions/RunningLiveQuizLink'
import StartLiveQuizButton from './actions/StartLiveQuizButton'
import getActivityDuplicationAction from './actions/getActivityDuplicationAction'
import LiveQuizDeletionModal from './modals/LiveQuizDeletionModal'

export type LiveQuizListElementType = Pick<
  LiveQuiz,
  | 'id'
  | 'status'
  | 'name'
  | 'numOfBlocks'
  | 'numOfInstances'
  | 'isGamificationEnabled'
  | 'accessMode'
>

function LiveQuizElement({ quiz }: { quiz: LiveQuizListElementType }) {
  const t = useTranslations()
  const router = useRouter()

  const [deletionModal, setDeletionModal] = useState(false)
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const onSuccessToast = () =>
    toast({
      type: 'success',
      message: t('manage.course.linkAccessCopied'),
      options: { duration: 4000 },
    })

  const statusTagMap: Record<PublicationStatus, React.ReactElement | null> = {
    [PublicationStatus.Draft]: (
      <StatusTag
        color="bg-gray-200"
        status={t('shared.generic.draft')}
        icon={faPencil}
      />
    ),
    [PublicationStatus.Scheduled]: (
      <StatusTag
        color="bg-orange-200"
        status={t('shared.generic.scheduled')}
        icon={faClock}
      />
    ),
    [PublicationStatus.Published]: (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.published')}
        icon={faPlay}
      />
    ),
    [PublicationStatus.Ended]: (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.completed')}
        icon={faCheck}
      />
    ),
    [PublicationStatus.Template]: (
      <StatusTag
        color="bg-primary-100"
        className="text-white"
        status={t('shared.generic.template')}
        icon={faFileLines}
      />
    ),
    [PublicationStatus.Graded]: null,
  }

  const [deleteLiveQuiz, { loading: deletingLiveQuiz }] = useMutation(
    DeleteLiveQuizDocument,
    {
      variables: { id: quiz.id },
      update(cache, res) {
        const data = cache.readQuery({
          query: GetSingleCourseDocument,
        })

        if (!data?.course || !res.data?.deleteLiveQuiz) {
          return null
        }

        cache.writeQuery({
          query: GetSingleCourseDocument,
          data: {
            course: {
              ...data.course,
              liveQuizzes: data.course.liveQuizzes?.filter(
                (quiz) => quiz.id !== res.data!.deleteLiveQuiz!.id
              ),
            },
          },
        })
      },
      optimisticResponse: {
        deleteLiveQuiz: {
          __typename: 'LiveQuiz',
          id: quiz.id,
        },
      },
      refetchQueries: [{ query: GetSingleCourseDocument }],
    }
  )

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/${dataUser?.userProfile?.shortname}`

  return (
    <div
      className="border-uzh-grey-80 w-full rounded border border-solid p-2"
      data-cy={`live-quiz-${quiz.name}`}
    >
      <div className="flex w-full flex-row justify-between">
        <div className="flex-1">
          <div className="flex flex-row gap-2">
            <Ellipsis
              maxLength={50}
              className={{ markdown: 'text-base font-bold' }}
            >
              {quiz.name}
            </Ellipsis>
          </div>
          <div className="mb-1 text-sm italic">
            {t('manage.liveQuizzes.nBlocksQuestions', {
              blocks: quiz.numOfBlocks,
              questions: quiz.numOfInstances,
            })}
          </div>
        </div>

        <div>
          <div className="flex flex-row items-center gap-2 text-sm">
            {(quiz.status === PublicationStatus.Scheduled ||
              quiz.status === PublicationStatus.Draft) && (
              <>
                <StartLiveQuizButton liveQuiz={quiz} />
                <Dropdown
                  data={{ cy: `live-quiz-actions-${quiz.name}` }}
                  className={{ item: 'py-1 text-sm' }}
                  trigger={<ActivityActionsTrigger />}
                  items={[
                    getAccessLink({
                      href,
                      onSuccess: onSuccessToast,
                      t,
                      name: quiz.name,
                    }),
                    dataUser?.userProfile?.catalyst
                      ? getLTIAccessLink({
                          href,
                          onSuccess: onSuccessToast,
                          t,
                          name: quiz.name,
                        })
                      : [],
                    {
                      label: (
                        <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-2">
                          <FontAwesomeIcon icon={faPencil} />
                          <div>{t('manage.liveQuizzes.editLiveQuiz')}</div>
                        </div>
                      ),
                      onClick: () =>
                        router.push({
                          pathname: '/',
                          query: {
                            elementId: quiz.id,
                            editMode: ActivityType.LiveQuiz,
                          },
                        }),
                      data: { cy: `edit-live-quiz-${quiz.name}` },
                    },
                    getActivityDuplicationAction({
                      id: quiz.id,
                      text: t('manage.liveQuizzes.duplicateLiveQuiz'),
                      wizardMode: ActivityType.LiveQuiz,
                      router: router,
                      data: { cy: `duplicate-live-quiz-${quiz.name}` },
                    }),
                    {
                      label: (
                        <div className="flex cursor-pointer flex-row items-center gap-2 text-red-600">
                          <FontAwesomeIcon icon={faTrashCan} />
                          <div>{t('manage.liveQuizzes.deleteLiveQuiz')}</div>
                        </div>
                      ),
                      onClick: () => setDeletionModal(true),
                      data: { cy: `delete-live-quiz-${quiz.name}` },
                    },
                  ].flat()}
                />
              </>
            )}
            {quiz.status === PublicationStatus.Published && (
              <>
                <RunningLiveQuizLink liveQuiz={quiz} />
                <Dropdown
                  data={{ cy: `live-quiz-actions-${quiz.name}` }}
                  className={{ item: 'py-1 text-sm' }}
                  trigger={<ActivityActionsTrigger />}
                  items={[
                    getAccessLink({
                      href,
                      onSuccess: onSuccessToast,
                      t,
                      name: quiz.name,
                    }),
                    dataUser?.userProfile?.catalyst
                      ? getLTIAccessLink({
                          href,
                          onSuccess: onSuccessToast,
                          t,
                          name: quiz.name,
                        })
                      : [],
                    getActivityDuplicationAction({
                      id: quiz.id,
                      text: t('manage.liveQuizzes.duplicateLiveQuiz'),
                      wizardMode: ActivityType.LiveQuiz,
                      router: router,
                      data: { cy: `duplicate-live-quiz-${quiz.name}` },
                    }),
                  ].flat()}
                />
              </>
            )}
            {quiz.status === PublicationStatus.Ended && (
              <>
                <EvaluationLinkLiveQuiz liveQuiz={quiz} />
                <Dropdown
                  data={{ cy: `live-quiz-actions-${quiz.name}` }}
                  className={{ item: 'py-1 text-sm' }}
                  trigger={<ActivityActionsTrigger />}
                  items={[
                    {
                      label: (
                        <div className="flex cursor-pointer flex-row items-center gap-2 text-red-600">
                          <FontAwesomeIcon icon={faTrashCan} />
                          <div>{t('manage.liveQuizzes.deleteLiveQuiz')}</div>
                        </div>
                      ),
                      onClick: () => setDeletionModal(true),
                      data: { cy: `delete-live-quiz-${quiz.name}` },
                    },
                    getActivityDuplicationAction({
                      id: quiz.id,
                      text: t('manage.liveQuizzes.duplicateLiveQuiz'),
                      wizardMode: ActivityType.LiveQuiz,
                      router: router,
                      data: { cy: `duplicate-live-quiz-${quiz.name}` },
                    }),
                  ]}
                />
              </>
            )}
          </div>
        </div>

        <LiveQuizDeletionModal
          quizId={quiz.id}
          open={deletionModal}
          setOpen={setDeletionModal}
          onDelete={deleteLiveQuiz}
          deleting={deletingLiveQuiz}
        />
      </div>

      <div className="flex w-full flex-row justify-between">
        <div className="flex flex-row gap-2">
          {quiz.isGamificationEnabled && (
            <StatusTag
              color="bg-uzh-red-40"
              status="Gamified"
              icon={faTrophy}
            />
          )}
          {quiz.accessMode === LiveQuizAccessMode.Public && (
            <StatusTag
              color="bg-green-300"
              status={t('manage.course.publicAccess')}
              icon={faUserGroup}
            />
          )}
          {quiz.accessMode === LiveQuizAccessMode.Restricted && (
            <StatusTag
              color="bg-red-300"
              status={t('manage.course.restrictedAccess')}
              icon={faLock}
            />
          )}
        </div>
        <div>{statusTagMap[quiz.status]}</div>
      </div>
    </div>
  )
}

export default LiveQuizElement
