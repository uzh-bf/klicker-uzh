import { useMutation } from '@apollo/client'
import { WizardMode } from '@components/sessions/creation/SessionCreation'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCopy,
  faHandPointer,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeletePracticeQuizDocument,
  GetSingleCourseDocument,
  PracticeQuiz,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import PracticeQuizAccessLink from './actions/PracticeQuizAccessLink'
import PracticeQuizPreviewLink from './actions/PracticeQuizPreviewLink'
import PublishPracticeQuizButton from './actions/PublishPracticeQuizButton'
import DeletionModal from './modals/DeletionModal'

interface PracticeQuizElementProps {
  practiceQuiz: Partial<PracticeQuiz>
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

  const [deletePracticeQuiz] = useMutation(DeletePracticeQuizDocument, {
    variables: { id: practiceQuiz.id! },
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/quiz/${practiceQuiz.id}/`

  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`practice-quiz-${practiceQuiz.name}`}
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {practiceQuiz.name || ''}
          </Ellipsis>
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
                    {
                      label: (
                        <div className="flex flex-row text-primary items-center gap-1 cursor-pointer">
                          <FontAwesomeIcon
                            icon={faCopy}
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
                        cy: `copy-practice-quiz-link-${practiceQuiz.name}`,
                      },
                    },
                    {
                      label: (
                        <PracticeQuizPreviewLink
                          practiceQuiz={practiceQuiz}
                          href={href}
                        />
                      ),
                      onClick: () => null,
                    },
                    {
                      label: (
                        <div className="flex flex-row items-center text-primary gap-1 cursor-pointer">
                          <FontAwesomeIcon icon={faPencil} />
                          <div>{t('manage.course.editPracticeQuiz')}</div>
                        </div>
                      ),
                      onClick: () =>
                        router.push({
                          pathname: '/',
                          query: {
                            sessionId: practiceQuiz.id,
                            editMode: WizardMode.PracticeQuiz,
                          },
                        }),
                      data: { cy: `edit-practice-quiz-${practiceQuiz.name}` },
                    },

                    {
                      label: (
                        <div className="flex flex-row items-center text-red-600 gap-1 cursor-pointer">
                          <FontAwesomeIcon
                            icon={faTrashCan}
                            className="w-[1.1rem]"
                          />
                          <div>{t('manage.course.deletePracticeQuiz')}</div>
                        </div>
                      ),
                      onClick: () => setDeletionModal(true),
                      data: { cy: `delete-practice-quiz-${practiceQuiz.name}` },
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

            {practiceQuiz.status === PublicationStatus.Published && (
              <>
                <PracticeQuizAccessLink
                  practiceQuiz={practiceQuiz}
                  href={href}
                />
                <Dropdown
                  className={{
                    item: 'p-1 hover:bg-gray-200',
                    viewport: 'bg-white',
                  }}
                  trigger={t('manage.course.otherActions')}
                  items={[
                    {
                      label: (
                        <PracticeQuizPreviewLink
                          practiceQuiz={practiceQuiz}
                          href={href}
                        />
                      ),
                      onClick: () => null,
                    },
                  ]}
                  triggerIcon={faHandPointer}
                />
                <StatusTag
                  color="bg-green-300"
                  status={t('shared.generic.published')}
                  icon={faUserGroup}
                />
              </>
            )}
          </div>
        </div>
        <div
          className="mb-1 text-sm italic"
          data-cy={`practice-quiz-num-of-questions-${practiceQuiz.name}`}
        >
          {t('pwa.microLearning.numOfQuestionSets', {
            number: practiceQuiz.numOfStacks || '0',
          })}
        </div>
      </div>
      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkPracticeQuizCopied')}
      </Toast>
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
