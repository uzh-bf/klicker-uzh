import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ThemeContext, Toast } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface LiveSessionCreationToastProps {
  editMode: boolean
  successToastOpen: boolean
  setSuccessToastOpen: (open: boolean) => void
}

function LiveSessionCreationToast({
  editMode,
  successToastOpen,
  setSuccessToastOpen,
}: LiveSessionCreationToastProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  return (
    <Toast
      duration={6000}
      openExternal={successToastOpen}
      setOpenExternal={setSuccessToastOpen}
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
            className={twMerge(theme.primaryText, 'ml-1')}
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
