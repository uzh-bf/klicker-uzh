import Ellipsis from '@components/common/Ellipsis'
import {
  faArrowRight,
  faCalculator,
  faCheck,
  faClock,
  faLock,
  faPlay,
  faTrophy,
  faUserGroup,
  faUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import Link from 'next/link'

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
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {session.name || ''}
          </Ellipsis>
          <div>{statusMap[session.status || 'PREPARED']}</div>
        </div>
        <div className="mb-1 italic">
          {session.blocks?.length || '0'} Blöcke, {numOfQuestions || '0'} Fragen
        </div>
        {/* // TODO: link to session editing for scheduled / prepared sessions */}
        {/* {(session.status === 'SCHEDULED' || session.status === 'PREPARED') && (
          <div className="flex flex-row items-center gap-2 text-uzh-blue-80">
            <FontAwesomeIcon icon={faArrowRight} />
            <Link href={`/sessions`}>
              Session editieren
            </Link>
          </div>
        )} */}
        {session.status === 'RUNNING' && (
          <div className="flex flex-row items-center gap-2 text-uzh-blue-80">
            <FontAwesomeIcon icon={faArrowRight} />
            <Link href={`/sessions/${session.id}/cockpit`}>
              Laufende Session
            </Link>
          </div>
        )}
        {session.status === 'COMPLETED' && (
          <div className="flex flex-row items-center gap-2 text-uzh-blue-80">
            <FontAwesomeIcon icon={faUpRightFromSquare} />
            <Link href={`/sessions/${session.id}/evaluation`} passHref>
              <a target="_blank" rel="noopener noreferrer">Evaluation</a>
            </Link>
          </div>
        )}
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
