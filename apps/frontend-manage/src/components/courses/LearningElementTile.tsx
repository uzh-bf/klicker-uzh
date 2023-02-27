import {
  faLink,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LearningElement,
  LearningElementStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, ThemeContext, Toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PublishConfirmationModal from './PublishConfirmationModal'
import StatusTag from './StatusTag'

interface LearningElementTileProps {
  courseId: string
  learningElement: Partial<LearningElement> &
    Pick<LearningElement, 'id' | 'name'>
}

function LearningElementTile({
  courseId,
  learningElement,
}: LearningElementTileProps) {
  const [copyToast, setCopyToast] = useState(false)
  const [publishModal, setPublishModal] = useState(false)
  const theme = useContext(ThemeContext)
  const router = useRouter()

  return (
    <div className="flex flex-col justify-between p-2 border border-solid rounded h-36 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80">
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {learningElement.name || ''}
          </Ellipsis>
          {learningElement.status === LearningElementStatus.Draft && (
            <StatusTag color="bg-gray-200" status="Draft" icon={faPencil} />
          )}
          {learningElement.status === LearningElementStatus.Published && (
            <StatusTag
              color="bg-green-300"
              status="Published"
              icon={faUserGroup}
            />
          )}
        </div>
        <div className="mb-1 italic">
          {learningElement.numOfInstances || '0'} Fragen
        </div>

        <Button
          basic
          onClick={() => {
            navigator.clipboard.writeText(
              `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${learningElement.id}/`
            )
            setCopyToast(true)
          }}
          className={{
            root: twMerge(
              'flex flex-row items-center gap-1',
              theme.primaryText
            ),
          }}
        >
          <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
          <div>Zugriffslink kopieren</div>
        </Button>

        {learningElement.status === LearningElementStatus.Draft && (
          <Button
            basic
            className={{ root: theme.primaryText }}
            onClick={() =>
              router.push({
                pathname: '/',
                query: {
                  sessionId: learningElement.id,
                  editMode: 'learningElement',
                },
              })
            }
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faPencil} />
            </Button.Icon>
            <Button.Label>Lernelement bearbeiten</Button.Label>
          </Button>
        )}

        {learningElement.status === LearningElementStatus.Draft && (
          <Button
            basic
            className={{ root: theme.primaryText }}
            onClick={() => setPublishModal(true)}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
            </Button.Icon>
            <Button.Label>Lernelement veröffentlichen</Button.Label>
          </Button>
        )}

        <Toast
          openExternal={copyToast}
          setOpenExternal={setCopyToast}
          type="success"
          className={{ root: 'w-[24rem]' }}
        >
          Der Link zum Lernelement wurde erfolgreich in die Zwischenablage
          kopiert.
        </Toast>
        <PublishConfirmationModal
          elementId={learningElement.id}
          title={learningElement.name}
          open={publishModal}
          setOpen={setPublishModal}
        />
      </div>
      <div className="flex flex-row gap-2"></div>
    </div>
  )
}

export default LearningElementTile
