import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Toast } from '@uzh-bf/design-system'
import Link from 'next/link'

interface LiveSessionCreationToastProps {
  editMode: boolean
  open: boolean
  setOpen: (open: boolean) => void
}

function LiveSessionCreationToast({
  editMode,
  open,
  setOpen,
}: LiveSessionCreationToastProps): React.ReactElement {
  return (
    <Toast
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
      type="success"
    >
      <div>
        {editMode ? (
          <div>Session erfolgreich angepasst!</div>
        ) : (
          <div>Session erfolgreich erstellt!</div>
        )}
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
          Zur
          <Link
            href="/sessions"
            className="ml-1 text-primary"
            data-cy="load-session-list"
          >
            Session-Liste
          </Link>
        </div>
      </div>
    </Toast>
  )
}

export default LiveSessionCreationToast
