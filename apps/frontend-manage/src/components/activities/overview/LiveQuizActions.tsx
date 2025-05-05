import { useMutation } from '@apollo/client'
import { faWpforms } from '@fortawesome/free-brands-svg-icons'
import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faChalkboardUser,
  faChartSimple,
  faCode,
  faEllipsis,
  faFilePen,
  faPencil,
  faPlay,
  faQrcode,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  DeleteLiveQuizDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import EmbeddingModal from '~/components/liveQuiz/EmbeddingModal'
import LiveQuizDeletionModal from '../../courses/modals/LiveQuizDeletionModal'
import TemplateConversionModal from '../../courses/modals/TemplateConversionModal'
import TemplateCreationErrorToast from '../../courses/modals/TemplateCreationErrorToast'
import TemplateCreationSuccessToast from '../../courses/modals/TemplateCreationSuccessToast'
import TemplateDeletionErrorToast from '../../courses/modals/TemplateDeletionErrorToast'
import TemplateDeletionModal from '../../courses/modals/TemplateDeletionModal'
import TemplateDeletionSuccessToast from '../../courses/modals/TemplateDeletionSuccessToast'
import TemplateEditErrorToast from '../../courses/modals/TemplateEditErrorToast'
import TemplateEditModal from '../../courses/modals/TemplateEditModal'
import TemplateEditSuccessToast from '../../courses/modals/TemplateEditSuccessToast'
import LiveQuizQRModal from '../../liveQuiz/cockpit/LiveQuizQRModal'
import LiveQuizNameChangeModal from '../../liveQuiz/LiveQuizNameChangeModal'
import ActivityActionButton from './ActivityActionButton'

function LiveQuizActions({ quiz }: { quiz: ActivityInfo }) {
  const t = useTranslations()
  const router = useRouter()

  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)
  const [editTemplateModal, setEditTemplateModal] = useState<boolean>(false)
  const [deletionTemplateModal, setDeletionTemplateModal] =
    useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)
  const [templateCreationSuccess, setTemplateCreationSuccess] = useState(false)
  const [templateCreationError, setTemplateCreationError] = useState(false)
  const [templateEditSuccess, setTemplateEditSuccess] = useState(false)
  const [templateEditError, setTemplateEditError] = useState(false)
  const [templateDeletionSuccess, setTemplateDeletionSuccess] = useState(false)
  const [templateDeletionError, setTemplateDeletionError] = useState(false)

  const [conversionModal, setConversionModal] = useState<{
    open: boolean
    activityId: string
    activityType: ActivityType
  }>({ open: false, activityId: '', activityType: ActivityType.LiveQuiz })

  const [startLiveQuiz, { loading: startingQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      variables: { id: quiz.id },
      update(cache) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes: [
              ...(data?.userRunningLiveQuizzes ?? []),
              { id: quiz.id, name: quiz.name },
            ],
          },
        })
      },
      optimisticResponse: {
        startLiveQuiz: {
          __typename: 'LiveQuizMeta',
          id: quiz.id,
          name: quiz.name,
          status: PublicationStatus.Published,
        },
      },
    }
  )

  const [deleteLiveQuiz, { loading: deletingLiveQuiz }] = useMutation(
    DeleteLiveQuizDocument,
    {
      variables: { id: quiz.id },
      update(cache) {
        const data = cache.readQuery({
          query: GetUserLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserLiveQuizzesDocument,
          data: {
            userLiveQuizzes:
              data?.userLiveQuizzes?.filter((q) => q.id !== quiz.id) ?? [],
          },
        })

        const data2 = cache.readQuery({
          query: GetUserActivitiesDocument,
        })
        cache.writeQuery({
          query: GetUserActivitiesDocument,
          data: {
            userActivities:
              data2?.userActivities?.filter((q) => q.id !== quiz.id) ?? [],
          },
        })
      },
      optimisticResponse: {
        deleteLiveQuiz: {
          __typename: 'LiveQuiz',
          id: quiz.id,
        },
      },
    }
  )

  return (
    <div>
      <div className="flex flex-row items-center gap-2">
        {quiz.status === PublicationStatus.Draft ||
        quiz.status === PublicationStatus.Scheduled ? (
          <ActivityActionButton
            disabled={startingQuiz}
            icon={faPlay}
            tooltip={t('manage.liveQuizzes.startLiveQuiz')}
            onClick={async () => {
              await startLiveQuiz()
              router.push(`quizzes/${quiz.id}/cockpit`)
            }}
            data={{ cy: `start-live-quiz-${quiz.name}` }}
          />
        ) : null}
        {quiz.status === PublicationStatus.Draft ? (
          <ActivityActionButton
            icon={faPencil}
            tooltip={t('manage.liveQuizzes.editLiveQuiz')}
            onClick={async () => {
              router.push({
                pathname: '/',
                query: {
                  elementId: quiz.id,
                  editMode: ActivityType.LiveQuiz,
                },
              })
            }}
            data={{ cy: `edit-live-quiz-${quiz.name}` }}
          />
        ) : null}

        {quiz.status === PublicationStatus.Published ? (
          <ActivityActionButton
            icon={faChalkboardUser}
            tooltip={t('manage.liveQuizzes.lecturerCockpit')}
            onClick={() => {
              router.push(`/quizzes/${quiz.id}/cockpit`)
            }}
            data={{ cy: `live-quiz-cockpit-${quiz.name}` }}
          />
        ) : null}

        {quiz.status === PublicationStatus.Published ||
        quiz.status === PublicationStatus.Ended ? (
          <ActivityActionButton
            icon={faChartSimple}
            tooltip={t('manage.liveQuizzes.liveQuizEvaluation')}
            onClick={() => {
              router.push(`/quizzes/${quiz.id}/cockpit`)
            }}
            data={{ cy: `live-quiz-evaluation-${quiz.name}` }}
          />
        ) : null}
        {quiz.status === PublicationStatus.Ended ||
        quiz.status === PublicationStatus.Scheduled ? (
          <ActivityActionButton
            icon={faCopy}
            tooltip={t('manage.liveQuizzes.duplicateLiveQuiz')}
            onClick={() => {
              router.push({
                pathname: '/',
                query: {
                  elementId: quiz.id,
                  duplicationMode: ActivityType.LiveQuiz,
                },
              })
            }}
            data={{ cy: `duplicate-live-quiz-${quiz.name}` }}
          />
        ) : null}

        {quiz.status === PublicationStatus.Ended ? (
          <ActivityActionButton
            icon={faCode}
            tooltip={t('manage.liveQuizzes.embeddingEvaluation')}
            onClick={() => {
              setEmbedModalOpen(true)
            }}
            data={{ cy: `show-embedding-modal-${quiz.name}` }}
          />
        ) : null}

        {quiz.status === PublicationStatus.Draft ||
        quiz.status === PublicationStatus.Scheduled ||
        quiz.status === PublicationStatus.Published ? (
          <ActivityActionButton
            icon={faQrcode}
            tooltip={t('manage.general.qrCode')}
            onClick={() => {
              setQrModalOpen(true)
            }}
            data={{ cy: `show-qr-modal-${quiz.name}` }}
          />
        ) : null}

        {quiz.status === PublicationStatus.Template ? (
          <ActivityActionButton
            icon={faPencil}
            tooltip={t('manage.template.editTemplate')}
            onClick={() => setEditTemplateModal(true)}
            data={{ cy: `edit-template-${quiz.name}` }}
          />
        ) : null}
        {quiz.status === PublicationStatus.Template ? (
          <ActivityActionButton
            icon={faWpforms}
            tooltip={t('manage.catalog.useTemplate')}
            onClick={() => router.push(`/templates/${quiz.templateId}`)}
            data={{ cy: `use-template-${quiz.name}` }}
          />
        ) : null}
        {quiz.status === PublicationStatus.Template ? (
          <ActivityActionButton
            icon={faTrashCan}
            tooltip={t('manage.template.deleteTemplate')}
            onClick={() => {
              setDeletionTemplateModal(true)
            }}
            className="border-red-600 text-red-600 hover:text-red-600"
            data={{ cy: `delete-template-${quiz.name}` }}
          />
        ) : null}

        {quiz.status !== PublicationStatus.Template ? (
          <Dropdown
            items={[
              // embed evaluation - for DRAFT, SCHEDULED, PUBLISHED, ENDED
              ...(quiz.status === PublicationStatus.Draft ||
              quiz.status === PublicationStatus.Scheduled ||
              quiz.status === PublicationStatus.Published
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
                          <FontAwesomeIcon
                            icon={faCode}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.liveQuizzes.embeddingEvaluation')}
                        </div>
                      ),
                      onClick: () => setEmbedModalOpen(true),
                      data: { cy: `show-embedding-modal-${quiz.name}` },
                    },
                  ]
                : []),

              // duplicate - for DRAFT, SCHEDULED, PUBLISHED
              ...(quiz.status === PublicationStatus.Draft ||
              quiz.status === PublicationStatus.Published
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
                          <FontAwesomeIcon
                            icon={faCopy}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.liveQuizzes.duplicateLiveQuiz')}
                        </div>
                      ),
                      onClick: () =>
                        router.push({
                          pathname: '/',
                          query: {
                            elementId: quiz.id,
                            duplicationMode: ActivityType.LiveQuiz,
                          },
                        }),
                      data: { cy: `duplicate-live-quiz-${quiz.name}` },
                    },
                  ]
                : []),

              // convert to template - for DRAFT
              ...(quiz.status === PublicationStatus.Draft
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
                          <FontAwesomeIcon
                            icon={faFilePen}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.template.convertOption')}
                        </div>
                      ),
                      onClick: () =>
                        setConversionModal({
                          open: true,
                          activityId: quiz.id,
                          activityType: ActivityType.LiveQuiz,
                        }),
                      data: { cy: `template-from-live-quiz-${quiz.name}` },
                    },
                  ]
                : []),

              // delete - for DRAFT, SCHEDULED, ENDED
              ...(quiz.status === PublicationStatus.Draft ||
              quiz.status === PublicationStatus.Scheduled ||
              quiz.status === PublicationStatus.Ended
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
                          <FontAwesomeIcon
                            icon={faTrashCan}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.liveQuizzes.deleteLiveQuiz')}
                        </div>
                      ),
                      onClick: () => setDeletionModal(true),
                      data: { cy: `delete-live-quiz-${quiz.name}` },
                    },
                  ]
                : []),
            ]}
            trigger={
              <ActivityActionButton
                icon={faEllipsis}
                onClick={() => {}}
                data={{ cy: `actions-live-quiz-${quiz.name}` }}
              />
            }
          />
        ) : null}
      </div>
      <div>
        <LiveQuizDeletionModal
          quizId={quiz.id}
          open={deletionModal}
          setOpen={setDeletionModal}
          onDelete={deleteLiveQuiz}
          deleting={deletingLiveQuiz}
        />
        <LiveQuizNameChangeModal
          quizId={quiz.id}
          name={quiz.name}
          displayName={quiz.displayName}
          open={changeName}
          setOpen={setChangeName}
        />
        <TemplateDeletionModal
          activityId={quiz.id}
          activityType={ActivityType.LiveQuiz}
          open={deletionTemplateModal}
          setOpen={setDeletionTemplateModal}
          onSuccess={() => setTemplateDeletionSuccess(true)}
          onError={() => setTemplateDeletionError(true)}
        />
        <TemplateEditModal
          activityId={quiz.id}
          activityType={ActivityType.LiveQuiz}
          open={editTemplateModal}
          setOpen={setEditTemplateModal}
          onSuccess={() => setTemplateEditSuccess(true)}
          onError={() => setTemplateEditError(true)}
        />

        <LiveQuizQRModal
          quizId={quiz.id}
          open={qrModalOpen}
          setOpen={setQrModalOpen}
        />
        <EmbeddingModal
          key={quiz.id}
          open={embedModalOpen}
          onClose={() => setEmbedModalOpen(false)}
          quizId={quiz.id}
          elements={quiz.stacks.flatMap((stack) =>
            stack.elements.map((instance) => ({
              id: instance.id,
              name: instance.name,
            }))
          )}
        />

        <TemplateConversionModal
          open={conversionModal.open}
          setOpen={(open) => setConversionModal({ ...conversionModal, open })}
          activityId={conversionModal.activityId}
          activityType={conversionModal.activityType}
          onSuccess={() => setTemplateCreationSuccess(true)}
          onError={() => setTemplateCreationError(true)}
        />
        <TemplateCreationSuccessToast
          open={templateCreationSuccess}
          onClose={() => setTemplateCreationSuccess(false)}
        />
        <TemplateCreationErrorToast
          open={templateCreationError}
          onClose={() => setTemplateCreationError(false)}
        />
        <TemplateEditSuccessToast
          open={templateEditSuccess}
          onClose={() => setTemplateEditSuccess(false)}
        />
        <TemplateEditErrorToast
          open={templateEditError}
          onClose={() => setTemplateEditError(false)}
        />
        <TemplateDeletionSuccessToast
          open={templateDeletionSuccess}
          onClose={() => setTemplateDeletionSuccess(false)}
        />
        <TemplateDeletionErrorToast
          open={templateDeletionError}
          onClose={() => setTemplateDeletionError(false)}
        />
      </div>
    </div>
  )
}

export default LiveQuizActions
