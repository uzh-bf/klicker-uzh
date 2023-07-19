import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Toast } from '@uzh-bf/design-system'
import Link from 'next/link'

interface LearningElementCreationToastProps {
  editMode: boolean
  courseId: string
  open: boolean
  setOpen: (open: boolean) => void
}

function LearningElementCreationToast({
  editMode,
  courseId,
  open,
  setOpen,
}: LearningElementCreationToastProps): React.ReactElement {
  return (
    <Toast
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
      type="success"
    >
      <div>
        {editMode ? (
          <div>Lernelement erfolgreich angepasst!</div>
        ) : (
          <div>Lernelement erfolgreich erstellt!</div>
        )}
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
          Zur
          <Link
            href={`/courses/${courseId}`}
            className="ml-1 text-primary"
            id="load-course-link"
          >
            Kursübersicht
          </Link>
        </div>
      </div>
    </Toast>
  )
}

export default LearningElementCreationToast
