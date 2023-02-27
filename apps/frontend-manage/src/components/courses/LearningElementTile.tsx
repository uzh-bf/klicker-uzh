import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LearningElement } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, ThemeContext, Toast } from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface LearningElementTileProps {
  courseId: string
  learningElement: Partial<LearningElement>
}

function LearningElementTile({
  courseId,
  learningElement,
}: LearningElementTileProps) {
  const [copyToast, setCopyToast] = useState(false)
  const theme = useContext(ThemeContext)

  // TODO: readd link `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${learningElement.id}/`
  return (
    <div className="p-2 border border-solid rounded h-36 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80">
      <div className="flex flex-row justify-between">
        <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
          {learningElement.name || ''}
        </Ellipsis>
        {/* // TODO: status symbols */}
        {/* {learningElement.status === LearningElementStatus.DRAFT && (
          <div>Draft</div>
        )} */}
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
          root: twMerge('flex flex-row items-center gap-1', theme.primaryText),
        }}
      >
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>Zugriffslink kopieren</div>
      </Button>

      {/* // TODO: learning element editing */}
      {/* <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faUpRightFromSquare} />
          <Link href={`/${learningElement.id}/edit`} passHref>
            <a target="_blank" rel="noopener noreferrer">
              Learning element bearbeiten
            </a>
          </Link>
        </div> */}
      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        Der Link zum Lernelement wurde erfolgreich in die Zwischenablage
        kopiert.
      </Toast>
    </div>
  )
}

export default LearningElementTile
