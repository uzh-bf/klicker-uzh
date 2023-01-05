import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ThemeContext, Toast } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface MicroSessionCreationToastProps {
  courseId: string
  successToastOpen: boolean
  setSuccessToastOpen: (open: boolean) => void
}

function MicroSessionCreationToast({
  courseId,
  successToastOpen,
  setSuccessToastOpen,
}: MicroSessionCreationToastProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  return (
    <Toast
      duration={6000}
      openExternal={successToastOpen}
      setOpenExternal={setSuccessToastOpen}
      type="success"
    >
      <div>
        <div>Micro-Session erfolgreich erstellt!</div>
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
          Zur
          <Link
            href={`/courses/${courseId}`}
            className={twMerge(theme.primaryText, 'ml-1')}
            id="load-course-link"
          >
            Kursübersicht
          </Link>
        </div>
      </div>
    </Toast>
  )
}

export default MicroSessionCreationToast
