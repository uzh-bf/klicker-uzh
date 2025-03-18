import { useMutation, useQuery } from '@apollo/client'
import {
  faClock,
  faCopy,
  faFile,
  faFileLines,
} from '@fortawesome/free-regular-svg-icons'
import {
  IconDefinition,
  faArrowUpRightFromSquare,
  faCalendarDays,
  faCheck,
  faCode,
  faFilePen,
  faPencil,
  faPlay,
  faQrcode,
  faTrash,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  CheckPrivatePreviewAvailableDocument,
  DeleteLiveQuizDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  LiveQuiz as LiveQuizType,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Collapsible, H3, H4 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { WizardMode } from '../activities/ElementCreation'
import LiveQuizDeletionModal from '../courses/modals/LiveQuizDeletionModal'
import TemplateConversionModal from '../courses/modals/TemplateConversionModal'
import TemplateCreationErrorToast from '../courses/modals/TemplateCreationErrorToast'
import TemplateCreationSuccessToast from '../courses/modals/TemplateCreationSuccessToast'
import TemplateDeletionErrorToast from '../courses/modals/TemplateDeletionErrorToast'
import TemplateDeletionModal from '../courses/modals/TemplateDeletionModal'
import TemplateDeletionSuccessToast from '../courses/modals/TemplateDeletionSuccessToast'
import TemplateEditErrorToast from '../courses/modals/TemplateEditErrorToast'
import TemplateEditModal from '../courses/modals/TemplateEditModal'
import TemplateEditSuccessToast from '../courses/modals/TemplateEditSuccessToast'
import EmbeddingModal from './EmbeddingModal'
import LiveQuizNameChangeModal from './LiveQuizNameChangeModal'
import LiveQuizQRModal from './cockpit/LiveQuizQRModal'

function LiveQuiz({
  isTemplate = false,
  highlighted = false,
  quiz,
}: {
  isTemplate?: boolean
  highlighted?: boolean
  quiz: Pick<
    LiveQuizType,
    | 'id'
    | 'name'
    | 'displayName'
    | 'status'
    | 'numOfBlocks'
    | 'numOfInstances'
    | 'createdAt'
    | 'startedAt'
    | 'finishedAt'
    | 'blocks'
  >
}) {
  const t = useTranslations()
  const router = useRouter()

  const { data: privatePreviewData } = useQuery(
    CheckPrivatePreviewAvailableDocument,
    {
      fetchPolicy: 'cache-first',
    }
  )

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
      },
      optimisticResponse: {
        deleteLiveQuiz: {
          __typename: 'LiveQuiz',
          id: quiz.id,
        },
      },
    }
  )

  const [showDetails, setShowDetails] = useState<boolean>(false)
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

  const timeIcon: Record<PublicationStatus, IconDefinition> = {
    [PublicationStatus.Draft]: faCalendarDays,
    [PublicationStatus.Scheduled]: faClock,
    [PublicationStatus.Published]: faPlay,
    [PublicationStatus.Ended]: faCheck,
    [PublicationStatus.Graded]: faCheck,
    [PublicationStatus.Template]: faFileLines,
  }
  const timeStamp: Record<PublicationStatus, string | null> = {
    [PublicationStatus.Draft]: quiz.createdAt,
    [PublicationStatus.Scheduled]: quiz.createdAt,
    [PublicationStatus.Published]: quiz.startedAt,
    [PublicationStatus.Ended]: quiz.finishedAt,
    [PublicationStatus.Graded]: quiz.finishedAt,
    [PublicationStatus.Template]: null,
  }

  useEffect(() => {
    if (highlighted) {
      setShowDetails(true)
    }
  }, [highlighted])

  return (
    <>
      <div
        key={quiz.id}
        className={twMerge(
          'rounded-md border p-1',
          highlighted && 'border-primary-100 border-2 bg-orange-50'
        )}
        data-cy={`live-quiz-${quiz.name}`}
      >
        {/* // TODO: remove additional tailwind styles, which are not imported correctly */}
        {/* <div className="col-span-1 col-span-2 col-span-3 col-span-4 col-span-5" /> */}
        <Collapsible
          className={{
            root: 'border-0 !py-0.5',
          }}
          key={quiz.id}
          open={showDetails}
          onChange={() => {
            setShowDetails((prev) => !prev)
          }}
          staticContent={
            <div className="flex flex-row justify-between">
              <div className="flex flex-row items-center gap-3">
                <H3 className={{ root: 'mb-0' }}>{quiz.name}</H3>
                {!isTemplate && (
                  <FontAwesomeIcon
                    icon={faPencil}
                    size="sm"
                    onClick={() => setChangeName(true)}
                    className="hover:cursor-pointer"
                    data-cy={`change-liveQuiz-name-${quiz.name}`}
                  />
                )}
              </div>
              {isTemplate ? (
                <div className="text-primary-100 flex items-center gap-1 rounded-md px-2 py-1 font-semibold">
                  <FontAwesomeIcon icon={faFile} className="mr-1" />
                  {t('shared.generic.template')}
                </div>
              ) : (
                <div className="mr-2 flex flex-row">
                  {quiz.blocks?.length !== 0 && (
                    <>
                      <Button
                        basic
                        className={{ root: 'h-7 text-sm' }}
                        onClick={() => setEmbedModalOpen(true)}
                        data={{ cy: `show-embedding-modal-${quiz.name}` }}
                      >
                        <Button.Icon icon={faCode} />
                        <Button.Label>
                          {t('manage.liveQuizzes.embeddingEvaluation')}
                        </Button.Label>
                      </Button>
                      <EmbeddingModal
                        key={quiz.id}
                        open={embedModalOpen}
                        onClose={() => setEmbedModalOpen(false)}
                        quizId={quiz.id}
                        elements={quiz.blocks
                          ?.flatMap((block) => block.elements)
                          .filter(
                            (instance) =>
                              typeof instance !== 'undefined' &&
                              instance !== null
                          )}
                      />
                    </>
                  )}

                  {quiz.status !== PublicationStatus.Ended && (
                    <>
                      <Button
                        basic
                        onClick={() => setQrModalOpen(true)}
                        className={{ root: 'h-7 text-sm' }}
                        data={{ cy: `show-qr-modal-${quiz.name}` }}
                      >
                        <Button.Icon icon={faQrcode} />
                        <Button.Label>
                          {t('manage.general.qrCode')}
                        </Button.Label>
                      </Button>
                      <LiveQuizQRModal
                        quizId={quiz.id}
                        open={qrModalOpen}
                        setOpen={setQrModalOpen}
                      />
                    </>
                  )}

                  {PublicationStatus.Published === quiz.status && (
                    <Button
                      basic
                      onClick={() => router.push(`/quizzes/${quiz.id}/cockpit`)}
                      className={{ root: 'h-7 text-sm' }}
                      data={{ cy: `live-quiz-cockpit-${quiz.name}` }}
                    >
                      <Button.Icon icon={faArrowUpRightFromSquare} />
                      <Button.Label>
                        {t('manage.liveQuizzes.lecturerCockpit')}
                      </Button.Label>
                    </Button>
                  )}
                  {PublicationStatus.Ended === quiz.status && (
                    <Button
                      basic
                      onClick={() =>
                        window.open(`/quizzes/${quiz.id}/evaluation`, '_blank')
                      }
                      className={{ root: 'h-7 text-sm' }}
                      data={{ cy: `live-quiz-evaluation-${quiz.name}` }}
                    >
                      <Button.Icon
                        icon={faArrowUpRightFromSquare}
                        className={{ root: 'h-3.5 w-3.5' }}
                      />
                      <Button.Label>
                        {t('manage.liveQuizzes.liveQuizEvaluation')}
                      </Button.Label>
                    </Button>
                  )}
                  {(PublicationStatus.Draft === quiz.status ||
                    PublicationStatus.Scheduled === quiz.status) && (
                    <Button
                      basic
                      disabled={startingQuiz}
                      onClick={async () => {
                        await startLiveQuiz()
                        router.push(`quizzes/${quiz.id}/cockpit`)
                      }}
                      className={{ root: 'h-7 text-sm' }}
                      data={{ cy: `start-live-quiz-${quiz.name}` }}
                    >
                      <Button.Icon
                        icon={faPlay}
                        className={{ root: 'h-3.5 w-3.5' }}
                      />
                      <Button.Label>
                        {t('manage.liveQuizzes.startLiveQuiz')}
                      </Button.Label>
                    </Button>
                  )}
                  <div className="ml-3 flex flex-row items-center gap-1 text-sm">
                    <FontAwesomeIcon
                      icon={timeIcon[quiz.status]}
                      className="mr-1"
                    />
                    {dayjs(timeStamp[quiz.status]).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              )}
            </div>
          }
          closedContent={
            <div className="italic">
              {t('manage.liveQuizzes.nBlocksQuestions', {
                blocks: quiz.numOfBlocks,
                questions: quiz.numOfInstances,
              })}
            </div>
          }
          primary={
            <div className="float-right flex flex-row gap-2">
              {quiz.status !== PublicationStatus.Template && (
                <Button
                  className={{ root: 'px-3 py-1 text-sm' }}
                  onClick={() =>
                    router.push({
                      pathname: '/',
                      query: {
                        elementId: quiz.id,
                        duplicationMode: WizardMode.LiveQuiz,
                      },
                    })
                  }
                  data={{ cy: `duplicate-live-quiz-${quiz.name}` }}
                >
                  <Button.Icon icon={faCopy} />
                  <Button.Label>
                    {t('manage.liveQuizzes.duplicateLiveQuiz')}
                  </Button.Label>
                </Button>
              )}
              {(PublicationStatus.Draft === quiz.status ||
                PublicationStatus.Scheduled === quiz.status) && (
                <Button
                  className={{ root: 'px-3 py-1 text-sm' }}
                  onClick={() =>
                    router.push({
                      pathname: '/',
                      query: {
                        elementId: quiz.id,
                        editMode: WizardMode.LiveQuiz,
                      },
                    })
                  }
                  data={{ cy: `edit-live-quiz-${quiz.name}` }}
                >
                  <Button.Icon icon={faPencil} />
                  <Button.Label>
                    {t('manage.liveQuizzes.editLiveQuiz')}
                  </Button.Label>
                </Button>
              )}
              {PublicationStatus.Draft === quiz.status &&
                privatePreviewData?.checkPrivatePreviewAvailable && (
                  <Button
                    className={{ root: 'px-3 py-1 text-sm' }}
                    onClick={() =>
                      setConversionModal({
                        open: true,
                        activityId: quiz.id,
                        activityType: ActivityType.LiveQuiz,
                      })
                    }
                    data={{ cy: `template-from-live-quiz-${quiz.name}` }}
                  >
                    <Button.Icon icon={faFilePen} />
                    <Button.Label>{t('shared.generic.template')}</Button.Label>
                  </Button>
                )}
              {(PublicationStatus.Draft === quiz.status ||
                PublicationStatus.Scheduled === quiz.status ||
                PublicationStatus.Ended === quiz.status) && (
                <Button
                  className={{
                    root: 'border-red-600 px-3 py-1 text-sm',
                  }}
                  onClick={() => setDeletionModal(true)}
                  data={{ cy: `delete-live-quiz-${quiz.name}` }}
                >
                  <Button.Icon
                    icon={faTrash}
                    className={{ root: 'text-red-600' }}
                  />
                  <Button.Label>
                    {t('manage.liveQuizzes.deleteLiveQuiz')}
                  </Button.Label>
                </Button>
              )}
              {quiz.status === PublicationStatus.Template && (
                <>
                  <Button
                    className={{ root: 'px-3 py-1 text-sm' }}
                    onClick={() => setEditTemplateModal(true)}
                    data={{ cy: `edit-template-${quiz.name}` }}
                  >
                    <Button.Icon icon={faPencil} />
                    <Button.Label>
                      {t('manage.template.editTemplate')}
                    </Button.Label>
                  </Button>
                  <Button
                    className={{
                      root: 'border-red-600 px-3 py-1 text-sm',
                    }}
                    onClick={() => setDeletionTemplateModal(true)}
                    data={{ cy: `delete-template-${quiz.name}` }}
                  >
                    <Button.Icon
                      icon={faTrash}
                      className={{ root: 'text-red-600' }}
                    />
                    <Button.Label>
                      {t('manage.template.deleteTemplate')}
                    </Button.Label>
                  </Button>
                </>
              )}
            </div>
          }
        >
          <div className="mb-6 mt-4 flex flex-row gap-4 overflow-x-auto overflow-y-hidden">
            {quiz.blocks?.map((block, index) => (
              <div
                key={block.id}
                className="w-64 min-w-52 border-r border-black pr-4 last:border-r-0 last:pr-0"
              >
                <div className="flex flex-row justify-between">
                  <H4>
                    {t('shared.generic.blockN', {
                      number: index + 1,
                    })}
                  </H4>
                  {block.numOfParticipants ? (
                    <div className="flex flex-row items-center">
                      <div>{block.numOfParticipants}</div>
                      <FontAwesomeIcon
                        icon={faUserGroup}
                        className="ml-1 w-4"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  {block.elements?.map((instance) => (
                    <Link
                      href={`/questions/${instance.elementData!.elementId}`}
                      className="text-sm hover:text-slate-700"
                      key={instance.id}
                      legacyBehavior
                      passHref
                    >
                      <a
                        data-cy={`open-question-live-quiz-${instance.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="hover:text-primary-100 flex flex-row items-center justify-between gap-1.5 border-b text-sm">
                          <div>
                            {instance.elementData?.name} (
                            {t(`shared.${instance.elementData!.type}.short`)})
                          </div>
                          <FontAwesomeIcon
                            icon={faArrowUpRightFromSquare}
                            className="h-3 w-3"
                          />
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
                <div className="float-right text-sm">
                  {t('shared.generic.Nelements', {
                    number: block.elements?.length,
                  })}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
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
    </>
  )
}

export default LiveQuiz
