import { WizardMode } from '@components/sessions/creation/SessionCreation'
import { faCopy, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faExternalLink,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  PracticeQuiz,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import PracticeQuizDeletionModal from './modals/PracticeQuizDeletionModal'
import PublishConfirmationModal from './modals/PublishConfirmationModal'

interface PracticeQuizElementProps {
  practiceQuiz: Partial<PracticeQuiz>
  courseId: string
}

function PracticeQuizElement({
  practiceQuiz,
  courseId,
}: PracticeQuizElementProps) {
  const t = useTranslations()
  const [copyToast, setCopyToast] = useState(false)
  const [publishModal, setPublishModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const router = useRouter()

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
            <Button
              basic
              onClick={() => {
                try {
                  navigator.clipboard.writeText(href)
                  setCopyToast(true)
                } catch (e) {}
              }}
              className={{
                root: 'flex flex-row items-center gap-1 text-primary',
              }}
              data={{ cy: `copy-practice-quiz-link-${practiceQuiz.name}` }}
            >
              <FontAwesomeIcon icon={faCopy} size="sm" className="w-4" />
              <div>{t('manage.course.copyAccessLink')}</div>
            </Button>
            <Link href={href} target="_blank">
              <Button
                basic
                className={{
                  root: 'flex flex-row items-center gap-1 text-primary',
                }}
                data={{ cy: `open-practice-quiz-${practiceQuiz.name}` }}
              >
                <FontAwesomeIcon
                  icon={faExternalLink}
                  size="sm"
                  className="w-4"
                />
                <div>{t('shared.generic.open')}</div>
              </Button>
            </Link>

            {practiceQuiz.status === PublicationStatus.Draft && (
              <Button
                basic
                className={{ root: 'text-primary' }}
                onClick={() =>
                  router.push({
                    pathname: '/',
                    query: {
                      sessionId: practiceQuiz.id,
                      editMode: WizardMode.PracticeQuiz,
                    },
                  })
                }
                data={{ cy: `edit-practice-quiz-${practiceQuiz.name}` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPencil} />
                </Button.Icon>
                <Button.Label>
                  {t('manage.course.editPracticeQuiz')}
                </Button.Label>
              </Button>
            )}

            {practiceQuiz.status === PublicationStatus.Draft && (
              <Button
                basic
                className={{ root: 'text-primary' }}
                onClick={() => setPublishModal(true)}
                data={{ cy: `publish-practice-quiz-${practiceQuiz.name}` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
                </Button.Icon>
                <Button.Label>
                  {t('manage.course.publishPracticeQuiz')}
                </Button.Label>
              </Button>
            )}

            {practiceQuiz.status === PublicationStatus.Draft && (
              <Button
                basic
                className={{ root: 'text-red-600' }}
                onClick={() => setDeletionModal(true)}
                data={{ cy: `delete-practice-quiz-${practiceQuiz.name}` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
                </Button.Icon>
                <Button.Label>
                  {t('manage.course.deletePracticeQuiz')}
                </Button.Label>
              </Button>
            )}

            {practiceQuiz.status === PublicationStatus.Draft && (
              <StatusTag
                color="bg-gray-200"
                status={t('shared.generic.draft')}
                icon={faPencil}
              />
            )}
            {practiceQuiz.status === PublicationStatus.Published && (
              <StatusTag
                color="bg-green-300"
                status={t('shared.generic.published')}
                icon={faUserGroup}
              />
            )}
          </div>
        </div>
        <div
          className="mb-1 text-sm italic"
          data-cy={`practice-quiz-num-of-questions-${practiceQuiz.name}`}
        >
          {t('manage.course.nQuestions', {
            number: practiceQuiz.numOfQuestions || '0',
          })}
        </div>

        <Toast
          openExternal={copyToast}
          setOpenExternal={setCopyToast}
          type="success"
          className={{ root: 'w-[24rem]' }}
        >
          {t('manage.course.linkPracticeQuizCopied')}
        </Toast>
        <PublishConfirmationModal
          elementType={ElementInstanceType.PracticeQuiz}
          elementId={practiceQuiz.id!}
          title={practiceQuiz.name!}
          open={publishModal}
          setOpen={setPublishModal}
        />
        <PracticeQuizDeletionModal
          elementId={practiceQuiz.id!}
          title={practiceQuiz.name!}
          open={deletionModal}
          setOpen={setDeletionModal}
        />
      </div>
    </div>
  )
}

export default PracticeQuizElement
