import {
  faCalculator,
  faCheck,
  faClock,
  faLock,
  faPlay,
  faTrophy,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { H4 } from '@uzh-bf/design-system'

interface SessionTileProps {
  session: Partial<Session>
}

function SessionTile({ session }: SessionTileProps) {
  const numOfQuestions = session.blocks?.reduce((acc, block) => {
    return acc + block.instances?.length
  }, 0)

  const statusMap = {
    PREPARED: <FontAwesomeIcon icon={faClock} />,
    SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
    RUNNING: <FontAwesomeIcon icon={faPlay} />,
    COMPLETED: <FontAwesomeIcon icon={faCheck} />,
  }

  return (
    <div
      key={session.id}
      className="p-2 border border-solid rounded h-36 min-w-[18rem] max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-row justify-between">
          <H4>{session.name}</H4>
          <div>{statusMap[session.status || 'PREPARED']}</div>
        </div>
        <div className="italic">
          {session.blocks?.length} Blöcke, {numOfQuestions} Fragen
        </div>
        <div>PIN: {session.pinCode}</div>
      </div>
      <div className="flex flex-row gap-2 ">
        <div className="py-0.5 px-1 text-sm rounded bg-uzh-red-40 flex flex-row items-center gap-1">
          <div>Gamified</div>
          <FontAwesomeIcon icon={faTrophy} />
        </div>
        {session.accessMode === 'PUBLIC' && (
          <div className="py-0.5 px-1 text-sm rounded bg-green-300 flex flex-row items-center gap-1">
            <div>Access Public</div>
            <FontAwesomeIcon icon={faUserGroup} />
          </div>
        )}
        {session.accessMode === 'RESTRICTED' && (
          <div className="py-0.5 px-1 text-sm rounded bg-red-300 flex flex-row items-center gap-1">
            <div>Access Restricted</div>
            <FontAwesomeIcon icon={faLock} />
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionTile
