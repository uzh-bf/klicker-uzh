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
  faShare,
  faX,
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
  SharingObjectType,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import EmbeddingModal from '~/components/liveQuiz/EmbeddingModal'
import ObjectSharingModalWrapper from '~/components/sharing/ObjectSharingModalWrapper'
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
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'startLiveQuiz',
    'editLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'templateFromLiveQuiz',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Scheduled]: [
    'startLiveQuiz',
    'duplicateLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Published]: [
    'lecturerCockpit',
    'liveQuizEvaluation',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'shareLiveQuiz',
    'removeLiveQuiz',
  ],
  [PublicationStatus.Ended]: [
    'liveQuizEvaluation',
    'duplicateLiveQuiz',
    'embeddingEvaluation',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Template]: [
    'editTemplate',
    'useTemplate',
    'deleteTemplate',
  ],
  [PublicationStatus.Graded]: [],
}

// limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
const permissionActionMap = {
  isManager: [
    'duplicateLiveQuiz',
    'templateFromLiveQuiz',
    'shareLiveQuiz',
    'deleteLiveQuiz',
    'deleteTemplate',
  ],
  isEditor: ['editLiveQuiz', 'editTemplate'],
  isExecutor: ['startLiveQuiz', 'lecturerCockpit'],
  isShared: [
    'qrCode',
    'embeddingEvaluation',
    'liveQuizEvaluation',
    'useTemplate',
  ],
  isRemovable: ['removeLiveQuiz'],
}

function LiveQuizActions({ quiz }: { quiz: ActivityInfo }) {
  const t = useTranslations()
  const router = useRouter()

  const [embeddingModal, setEmbeddingModal] = useState<boolean>(false)
  const [qrModal, setQRModal] = useState<boolean>(false)
  const [deletionModal, setDeletionModal] = useState<boolean>(false)
  const [removalModal, setRemovalModal] = useState<boolean>(false)
  const [templateEditingModal, setTemplateEditingModal] =
    useState<boolean>(false)
  const [templateDeletionModal, setTemplateDeletionModal] =
    useState<boolean>(false)
  const [sharingModal, setSharingModal] = useState<boolean>(false)
  const [nameChangeModal, setNameChangeModal] = useState<boolean>(false)
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

  const ACTIONS = useMemo(
    () => [
      {
        id: 'startLiveQuiz',
        label: t('manage.liveQuizzes.startLiveQuiz'),
        icon: faPlay,
        onClick: async () => {
          await startLiveQuiz()
          router.push(`quizzes/${quiz.id}/cockpit`)
        },
        disabled: startingQuiz,
        data: { cy: `start-live-quiz-${quiz.name}` },
      },
      {
        id: 'editLiveQuiz',
        label: t('manage.liveQuizzes.editLiveQuiz'),
        icon: faPencil,
        onClick: () => {
          router.push({
            pathname: '/',
            query: {
              elementId: quiz.id,
              editMode: ActivityType.LiveQuiz,
            },
          })
        },
        data: { cy: `edit-live-quiz-${quiz.name}` },
      },
      {
        id: 'lecturerCockpit',
        label: t('manage.liveQuizzes.lecturerCockpit'),
        icon: faChalkboardUser,
        onClick: () => {
          router.push(`/quizzes/${quiz.id}/cockpit`)
        },
        data: { cy: `live-quiz-cockpit-${quiz.name}` },
      },
      {
        id: 'liveQuizEvaluation',
        label: t('manage.liveQuizzes.liveQuizEvaluation'),
        icon: faChartSimple,
        onClick: () => {
          window.open(`/quizzes/${quiz.id}/evaluation`, '_blank')
        },
        data: { cy: `live-quiz-evaluation-${quiz.name}` },
      },
      {
        id: 'duplicateLiveQuiz',
        label: t('manage.liveQuizzes.duplicateLiveQuiz'),
        icon: faCopy,
        onClick: () => {
          router.push({
            pathname: '/',
            query: {
              elementId: quiz.id,
              duplicationMode: ActivityType.LiveQuiz,
            },
          })
        },
        data: { cy: `duplicate-live-quiz-${quiz.name}` },
      },
      {
        id: 'embeddingEvaluation',
        label: t('manage.liveQuizzes.embeddingEvaluation'),
        icon: faCode,
        onClick: () => {
          setEmbeddingModal(true)
        },
        data: { cy: `show-embedding-modal-${quiz.name}` },
      },
      {
        id: 'qrCode',
        label: t('manage.general.qrCode'),
        icon: faQrcode,
        onClick: () => {
          setQRModal(true)
        },
        data: { cy: `show-qr-modal-${quiz.name}` },
      },
      {
        id: 'editTemplate',
        label: t('manage.template.editTemplate'),
        icon: faPencil,
        onClick: () => {
          setTemplateEditingModal(true)
        },
        data: { cy: `edit-template-${quiz.name}` },
      },
      {
        id: 'useTemplate',
        label: t('manage.catalog.useTemplate'),
        icon: faWpforms,
        onClick: () => {
          router.push(`/templates/${quiz.templateId}`)
        },
        data: { cy: `use-template-${quiz.name}` },
      },
      {
        id: 'deleteTemplate',
        label: t('manage.template.deleteTemplate'),
        icon: faTrashCan,
        onClick: () => {
          setTemplateDeletionModal(true)
        },
        data: { cy: `delete-template-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'templateFromLiveQuiz',
        label: t('manage.template.convertOption'),
        icon: faFilePen,
        onClick: () => {
          setConversionModal({
            open: true,
            activityId: quiz.id,
            activityType: ActivityType.LiveQuiz,
          })
        },
        data: { cy: `template-from-live-quiz-${quiz.name}` },
      },
      {
        id: 'shareLiveQuiz',
        label: t('manage.liveQuizzes.shareLiveQuiz'),
        icon: faShare,
        onClick: () => {
          setSharingModal(true)
        },
        data: { cy: `share-live-quiz-${quiz.name}` },
      },
      {
        id: 'removeLiveQuiz',
        label: t('manage.liveQuizzes.removeLiveQuiz'),
        icon: faX,
        onClick: () => {
          setRemovalModal(true)
        },
        data: { cy: `remove-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'deleteLiveQuiz',
        label: t('manage.liveQuizzes.deleteLiveQuiz'),
        icon: faTrashCan,
        onClick: () => {
          setDeletionModal(true)
        },
        data: { cy: `delete-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
    ],
    [
      t,
      startLiveQuiz,
      router,
      quiz,
      startingQuiz,
      setEmbeddingModal,
      setQRModal,
      setTemplateEditingModal,
      setTemplateDeletionModal,
      setConversionModal,
      setSharingModal,
      setDeletionModal,
    ]
  )

  const availableActions = useMemo(
    () =>
      statusActionMap[quiz.status]
        .flatMap(
          (actionId) => ACTIONS.find((action) => action.id === actionId) ?? []
        )
        .filter((action) => {
          if (
            (quiz.isManager || quiz.isOwner) &&
            (permissionActionMap.isManager.includes(action.id) ||
              permissionActionMap.isEditor.includes(action.id) ||
              permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            quiz.isEditor &&
            (permissionActionMap.isEditor.includes(action.id) ||
              permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            quiz.isExecutor &&
            (permissionActionMap.isExecutor.includes(action.id) ||
              permissionActionMap.isShared.includes(action.id))
          ) {
            return true
          } else if (
            quiz.isShared &&
            permissionActionMap.isShared.includes(action.id)
          ) {
            return true
          } else if (
            quiz.isRemovable &&
            permissionActionMap.isRemovable.includes(action.id)
          ) {
            return true
          }
          return false
        }),
    [
      ACTIONS,
      quiz.isEditor,
      quiz.isExecutor,
      quiz.isManager,
      quiz.isOwner,
      quiz.isRemovable,
      quiz.isShared,
      quiz.status,
    ]
  )

  return (
    <div>
      <div className="flex flex-row items-center gap-2">
        {availableActions.slice(0, 3).map((action) => {
          return (
            <ActivityActionButton
              key={`live-quiz-${quiz.id}-${action.id}`}
              icon={action.icon}
              tooltip={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              data={action.data}
              className={action.className}
            />
          )
        })}

        {availableActions.length > 3 && (
          <Dropdown
            items={availableActions.slice(3).map((action) => ({
              label: (
                <div
                  className={`flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100 ${
                    action.className ?? ''
                  }`}
                >
                  <FontAwesomeIcon
                    icon={action.icon}
                    className="mr-2.5 h-4 w-4"
                  />
                  {action.label}
                </div>
              ),
              onClick: action.onClick,
              data: action.data,
            }))}
            trigger={
              <ActivityActionButton
                icon={faEllipsis}
                onClick={() => {}}
                data={{ cy: `actions-live-quiz-${quiz.name}` }}
              />
            }
            className={{
              viewport: 'z-20', // ensure that dropdown is shown above other elements on course overview
            }}
          />
        )}
      </div>
      <div>
        {deletionModal && (
          <LiveQuizDeletionModal
            quizId={quiz.id}
            open={deletionModal}
            setOpen={setDeletionModal}
            onDelete={deleteLiveQuiz}
            deleting={deletingLiveQuiz}
          />
        )}

        {nameChangeModal && (
          <LiveQuizNameChangeModal
            quizId={quiz.id}
            name={quiz.name}
            displayName={quiz.displayName}
            open={nameChangeModal}
            setOpen={setNameChangeModal}
          />
        )}

        {templateDeletionModal && (
          <TemplateDeletionModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateDeletionModal}
            setOpen={setTemplateDeletionModal}
            onSuccess={() => setTemplateDeletionSuccess(true)}
            onError={() => setTemplateDeletionError(true)}
          />
        )}
        {templateEditingModal && (
          <TemplateEditModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateEditingModal}
            setOpen={setTemplateEditingModal}
            onSuccess={() => setTemplateEditSuccess(true)}
            onError={() => setTemplateEditError(true)}
          />
        )}

        {qrModal && (
          <LiveQuizQRModal
            quizId={quiz.id}
            open={qrModal}
            setOpen={setQRModal}
          />
        )}

        {embeddingModal && (
          <EmbeddingModal
            key={quiz.id}
            open={embeddingModal}
            onClose={() => setEmbeddingModal(false)}
            quizId={quiz.id}
            elements={quiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => ({
                id: instance.id,
                name: instance.name,
              }))
            )}
          />
        )}

        {sharingModal && quiz.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={quiz.id}
            objectName={quiz.name}
            objectType={SharingObjectType.LiveQuiz}
            isOwner={quiz.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}

        {removalModal && quiz.isRemovable && (
          <ActivityRemovalModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            title={quiz.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
          />
        )}

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
