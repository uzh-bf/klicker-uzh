import { LearningElement } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

interface LearningElementTileProps {
  courseId: string
  learningElement: Partial<LearningElement>
}

function LearningElementTile({
  courseId,
  learningElement,
}: LearningElementTileProps) {
  return (
    <Link
      href={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${learningElement.id}/`}
      target="_blank"
    >
      <Button
        key={learningElement.id}
        className={{
          root: 'p-2 border border-solid rounded h-36 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between',
        }}
      >
        <div>
          <div className="flex flex-row justify-between">
            <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
              {learningElement.name || ''}
            </Ellipsis>
            {/* // TODO: status symbols */}
            {/* <div>{statusMap[learningElement.status || 'PREPARED']}</div> */}
          </div>
          <div className="mb-1 italic">
            {learningElement.numOfInstances || '0'} Fragen
          </div>

          {/* // TODO: learning element editing */}
          {/* <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faUpRightFromSquare} />
          <Link href={`/${learningElement.id}/edit`} passHref>
            <a target="_blank" rel="noopener noreferrer">
              Learning element bearbeiten
            </a>
          </Link>
        </div> */}
        </div>
      </Button>
    </Link>
  )
}

export default LearningElementTile
