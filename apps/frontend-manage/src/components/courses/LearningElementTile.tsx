import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCopy,
  faExternalLink,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LearningElement,
  LearningElementStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import StatusTag from './StatusTag'
import LearningElementDeletionModal from './modals/LearningElementDeletionModal'
import PublishConfirmationModal from './modals/PublishConfirmationModal'

interface LearningElementTileProps {
  courseId: string
  learningElement: Partial<LearningElement> &
    Pick<LearningElement, 'id' | 'name'>
}

function LearningElementTile({
  courseId,
  learningElement,
}: LearningElementTileProps) {
  const t = useTranslations()
  const [copyToast, setCopyToast] = useState(false)
  const [publishModal, setPublishModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const router = useRouter()

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${learningElement.id}/`

  return (
    <div
      className="flex flex-col justify-between p-2 border border-solid rounded w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80"
      data-cy={`practice-quiz-${learningElement.name}`}
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {learningElement.name || ''}
          </Ellipsis>
          {learningElement.status === LearningElementStatus.Draft && (
            <StatusTag
              color="bg-gray-200"
              status={t('shared.generic.draft')}
              icon={faPencil}
            />
          )}
          {learningElement.status === LearningElementStatus.Published && (
            <StatusTag
              color="bg-green-300"
              status={t('shared.generic.published')}
              icon={faUserGroup}
            />
          )}
        </div>
        <div
          className="mb-1 italic"
          data-cy={`practice-quiz-num-of-questions-${learningElement.name}`}
        >
          {t('manage.course.nQuestions', {
            number: learningElement.numOfQuestions || '0',
          })}
        </div>

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
          >
            <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
            <div>{t('shared.generic.open')}</div>
          </Button>
        </Link>

        {learningElement.status === LearningElementStatus.Draft && (
          <Button
            basic
            className={{ root: 'text-primary' }}
            onClick={() =>
              router.push({
                pathname: '/',
                query: {
                  sessionId: learningElement.id,
                  editMode: 'learningElement',
                },
              })
            }
            data={{ cy: `edit-practice-quiz-${learningElement.name}` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faPencil} />
            </Button.Icon>
            <Button.Label>
              {t('manage.course.editLearningElement')}
            </Button.Label>
          </Button>
        )}

        {learningElement.status === LearningElementStatus.Draft && (
          <Button
            basic
            className={{ root: 'text-primary' }}
            onClick={() => setPublishModal(true)}
            data={{ cy: `publish-practice-quiz-${learningElement.name}` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
            </Button.Icon>
            <Button.Label>
              {t('manage.course.publishLearningElement')}
            </Button.Label>
          </Button>
        )}

        {learningElement.status === LearningElementStatus.Draft && (
          <Button
            basic
            className={{ root: 'text-red-600' }}
            onClick={() => setDeletionModal(true)}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
            </Button.Icon>
            <Button.Label>
              {t('manage.course.deleteLearningElement')}
            </Button.Label>
          </Button>
        )}

        <Toast
          openExternal={copyToast}
          setOpenExternal={setCopyToast}
          type="success"
          className={{ root: 'w-[24rem]' }}
        >
          {t('manage.course.linkLearningElementCopied')}
        </Toast>
        <PublishConfirmationModal
          elementType="LEARNING_ELEMENT"
          elementId={learningElement.id}
          title={learningElement.name}
          open={publishModal}
          setOpen={setPublishModal}
        />
        <LearningElementDeletionModal
          elementId={learningElement.id}
          title={learningElement.name}
          open={deletionModal}
          setOpen={setDeletionModal}
        />
      </div>
    </div>
  )
}

export default LearningElementTile
