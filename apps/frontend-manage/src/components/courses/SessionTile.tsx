import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowRight,
  faCalculator,
  faCheck,
  faLock,
  faPlay,
  faTrophy,
  faUpRightFromSquare,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import StatusTag from './StatusTag'

interface SessionTileProps {
  session: Partial<Session>
}

function SessionTile({ session }: SessionTileProps) {
  const theme = useContext(ThemeContext)
  const router = useRouter()
  const statusMap = {
    PREPARED: <FontAwesomeIcon icon={faClock} />,
    SCHEDULED: <FontAwesomeIcon icon={faCalculator} />,
    RUNNING: <FontAwesomeIcon icon={faPlay} />,
    COMPLETED: <FontAwesomeIcon icon={faCheck} />,
  }

  return (
    <div
      key={session.id}
      className="p-2 border border-solid rounded h-36 w-full sm:min-w-[18rem] sm:max-w-[18rem] border-uzh-grey-80 flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {session.name || ''}
          </Ellipsis>
          <div>{statusMap[session.status || 'PREPARED']}</div>
        </div>
        <div className="mb-1 italic">
          {session.numOfBlocks || '0'} Blöcke, {session.numOfQuestions || '0'}{' '}
          Fragen
        </div>
        {(session.status === 'SCHEDULED' || session.status === 'PREPARED') && (
          <Button
            basic
            className={{ root: theme.primaryText }}
            onClick={() =>
              router.push({
                pathname: '/',
                query: { sessionId: session.id, editMode: 'liveSession' },
              })
            }
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
            <Button.Label>Session editieren</Button.Label>
          </Button>
        )}
        {session.status === 'RUNNING' && (
          <div
            className={twMerge(
              'flex flex-row items-center gap-2',
              theme.primaryText
            )}
          >
            <FontAwesomeIcon icon={faArrowRight} />
            <Link href={`/sessions/${session.id}/cockpit`}>
              Laufende Session
            </Link>
          </div>
        )}
        {session.status === 'COMPLETED' && (
          <div
            className={twMerge(
              'flex flex-row items-center gap-2',
              theme.primaryText
            )}
          >
            <FontAwesomeIcon icon={faUpRightFromSquare} />
            <Link
              href={`/sessions/${session.id}/evaluation`}
              passHref
              target="_blank"
              rel="noopener noreferrer"
            >
              Evaluation
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-row gap-2 ">
        {session.isGamificationEnabled && (
          <StatusTag color="bg-uzh-red-40" status="Gamified" icon={faTrophy} />
        )}
        {session.accessMode === 'PUBLIC' && (
          <StatusTag
            color="bg-green-300"
            status="Access Public"
            icon={faUserGroup}
          />
        )}
        {session.accessMode === 'RESTRICTED' && (
          <StatusTag
            color="bg-red-300"
            status="Access Restricted"
            icon={faLock}
          />
        )}
      </div>
    </div>
  )
}

export default SessionTile
