import { useMutation, useQuery } from '@apollo/client'
import { faClock, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCopy,
  faHandPointer,
  faHourglassStart,
  faLink,
  faLock,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeletePracticeQuizDocument,
  GetSingleCourseDocument,
  PracticeQuiz,
  PublicationStatus,
  UnpublishPracticeQuizDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import React, { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import CopyConfirmationToast from '../toasts/CopyConfirmationToast'
import StatusTag from './StatusTag'
import PracticeQuizAccessLink from './actions/PracticeQuizAccessLink'
import PracticeQuizEvaluationLink from './actions/PracticeQuizEvaluationLink'
import PublishPracticeQuizButton from './actions/PublishPracticeQuizButton'
import getActivityDuplicationAction from './actions/getActivityDuplicationAction'
import DeletionModal from './modals/DeletionModal'

interface AccessLinkArgs {
  name: string
  t: ReturnType<typeof useTranslations>
  href: string
  setCopyToast: (value: boolean) => void
  label?: string
}

export function getAccessLink({
  name,
  t,
  href,
  setCopyToast,
  label,
}: AccessLinkArgs) {
  return {
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
        <FontAwesomeIcon icon={faCopy} size="sm" className="w-4" />
        <div>
          {t('manage.course.copyAccessLink')}
          {typeof label == 'string' && ` (${label})`}
        </div>
      </div>
    ),
    onClick: () => {
      try {
        navigator.clipboard.writeText(href)
        setCopyToast(true)
      } catch (e) {}
    },
    data: {
      cy: `copy-quiz-link-${name}`,
    },
  }
}

export function getLTIAccessLink({
  name,
  t,
  href,
  setCopyToast,
  label,
}: AccessLinkArgs) {
  return {
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>
          {t('manage.course.copyLTIAccessLink')}
          {typeof label == 'string' && ` (${label})`}
        </div>
      </div>
    ),
    onClick: async () => {
      try {
        const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${href}`
        await navigator.clipboard.writeText(link)
        setCopyToast(true)
      } catch (e) {}
    },
    data: {
      cy: `copy-lti-link-${name}`,
    },
  }
}

interface PracticeQuizElementProps {
  practiceQuiz: Pick<
    PracticeQuiz,
    'id' | 'name' | 'status' | 'availableFrom' | 'numOfStacks'
  >
  courseId: string
}

function PracticeQuizElement({
  practiceQuiz,
  courseId,
}: PracticeQuizElementProps) {
  const t = useTranslations()
  const router = useRouter()
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const [deletePracticeQuiz] = useMutation(DeletePracticeQuizDocument, {
    variables: { id: practiceQuiz.id! },
    // TODO: add optimistic response and update cache
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const [unpublishPracticeQuiz] = useMutation(UnpublishPracticeQuizDocument, {
    variables: { id: practiceQuiz.id! },
    // TODO: add optimistic response and update cache
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/quiz/${practiceQuiz.id}/`
  const evaluationHref = `/practiceQuiz/${practiceQuiz.id}/evaluation`

  const statusMap: Record<PublicationStatus, React.ReactElement> = {
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
        icon={faUserGroup}
      />
    ),
  }

  const deletionItem = {
    label: (
      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
        <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
        <div>{t('manage.course.deletePracticeQuiz')}</div>
      </div>
    ),
    onClick: () => setDeletionModal(true),
    data: { cy: `delete-practice-quiz-${practiceQuiz.name}` },
  }

  return (
    <div
      className="border-uzh-grey-80 flex w-full flex-row justify-between rounded border border-solid p-2"
      data-cy={`practice-quiz-${practiceQuiz.name}`}
    >
      <div className="flex flex-1 flex-col">
        <Ellipsis maxLength={50} className={{ markdown: 'font-bold' }}>
          {practiceQuiz.name}
        </Ellipsis>

        <div
          className="mb-1 text-sm italic"
          data-cy={`practice-quiz-num-of-questions-${practiceQuiz.name}`}
        >
          {t('pwa.microLearning.numOfQuestionSets', {
            number: practiceQuiz.numOfStacks,
          })}
        </div>
        {practiceQuiz.availableFrom && (
          <div className="flex flex-row gap-4 text-sm">
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faHourglassStart} />
              <div>
                {t('manage.course.startAt', {
                  time: dayjs(practiceQuiz.availableFrom)
                    .local()
                    .format('DD.MM.YYYY, HH:mm'),
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-4">
        <div className="flex flex-row items-center gap-3 text-sm">
          {practiceQuiz.status === PublicationStatus.Draft && (
            <>
              <PublishPracticeQuizButton practiceQuiz={practiceQuiz} />
              <Dropdown
                data={{ cy: `practice-quiz-actions-${practiceQuiz.name}` }}
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
                    name: practiceQuiz.name,
                  }),
                  dataUser?.userProfile?.catalyst
                    ? getLTIAccessLink({
                        href,
                        setCopyToast,
                        t,
                        name: practiceQuiz.name,
                      })
                    : [],
                  // {
                  //   label: (
                  //     <PracticeQuizPreviewLink
                  //       practiceQuiz={practiceQuiz}
                  //       href={href}
                  //     />
                  //   ),
                  //   onClick: () => null,
                  // },
                  {
                    label: (
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                        <FontAwesomeIcon icon={faPencil} />
                        <div>{t('manage.course.editPracticeQuiz')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          elementId: practiceQuiz.id,
                          editMode: WizardMode.PracticeQuiz,
                        },
                      }),
                    data: { cy: `edit-practice-quiz-${practiceQuiz.name}` },
                  },
                  getActivityDuplicationAction({
                    id: practiceQuiz.id,
                    text: t('manage.course.duplicatePracticeQuiz'),
                    wizardMode: WizardMode.PracticeQuiz,
                    router: router,
                    data: {
                      cy: `duplicate-practice-quiz-${practiceQuiz.name}`,
                    },
                  }),
                  deletionItem,
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {practiceQuiz.status === PublicationStatus.Scheduled && (
            <>
              <PracticeQuizAccessLink practiceQuiz={practiceQuiz} href={href} />
              <Dropdown
                data={{ cy: `practice-quiz-actions-${practiceQuiz.name}` }}
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
                        name: practiceQuiz.name,
                      })
                    : [],
                  getActivityDuplicationAction({
                    id: practiceQuiz.id,
                    text: t('manage.course.duplicatePracticeQuiz'),
                    wizardMode: WizardMode.PracticeQuiz,
                    router: router,
                    data: {
                      cy: `duplicate-practice-quiz-${practiceQuiz.name}`,
                    },
                  }),
                  {
                    label: (
                      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
                        <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />

                        <div>{t('manage.course.unpublishPracticeQuiz')}</div>
                      </div>
                    ),
                    onClick: async () => await unpublishPracticeQuiz(),
                    data: {
                      cy: `unpublish-practiceQuiz-${practiceQuiz.name}`,
                    },
                  },
                  deletionItem,
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {practiceQuiz.status === PublicationStatus.Published && (
            <>
              <PracticeQuizAccessLink practiceQuiz={practiceQuiz} href={href} />
              <Dropdown
                data={{ cy: `practice-quiz-actions-${practiceQuiz.name}` }}
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
                        name: practiceQuiz.name,
                      })
                    : [],
                  // {
                  //   label: (
                  //     <PracticeQuizPreviewLink
                  //       practiceQuiz={practiceQuiz}
                  //       href={href}
                  //     />
                  //   ),
                  //   onClick: () => null,
                  // },
                  {
                    label: (
                      <PracticeQuizEvaluationLink
                        quizName={practiceQuiz.name}
                        evaluationHref={evaluationHref}
                      />
                    ),
                    onClick: () => null,
                  },
                  getActivityDuplicationAction({
                    id: practiceQuiz.id,
                    text: t('manage.course.duplicatePracticeQuiz'),
                    wizardMode: WizardMode.PracticeQuiz,
                    router: router,
                    data: {
                      cy: `duplicate-practice-quiz-${practiceQuiz.name}`,
                    },
                  }),
                  deletionItem,
                ].flat()}
                triggerIcon={faHandPointer}
              />
            </>
          )}
        </div>
        <div className="flex flex-row gap-2">
          {statusMap[practiceQuiz.status]}
        </div>
      </div>
      <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />
      <DeletionModal
        title={t('manage.course.deletePracticeQuiz')}
        description={t('manage.course.confirmDeletionPracticeQuiz')}
        elementName={practiceQuiz.name!}
        message={t('manage.course.hintDeletionPracticeQuiz')}
        deleteElement={deletePracticeQuiz}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-practice-quiz' }}
        secondaryData={{ cy: 'cancel-delete-practice-quiz' }}
      />
    </div>
  )
}

export default PracticeQuizElement
