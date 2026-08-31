import { faArchive, faInbox } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { Dispatch, SetStateAction } from 'react'

function CourseArchiveButton({
  id,
  name,
  isArchived,
  running,
  disabled = false,
  showArchiveModal,
}: {
  id: string
  name: string
  isArchived: boolean
  running: boolean
  disabled?: boolean
  showArchiveModal?: Dispatch<
    SetStateAction<{
      open: boolean
      courseId: string | null
      isArchived: boolean
    }>
  >
}) {
  return (
    <Button
      className={{
        root: 'h-9 w-9',
      }}
      onClick={(e) => {
        e?.stopPropagation()
        e?.preventDefault()
        showArchiveModal?.({ open: true, courseId: id, isArchived })
      }}
      disabled={running || disabled}
      data={{ cy: `archive-course-${name}` }}
    >
      <Button.Icon withoutLabel icon={isArchived ? faInbox : faArchive} />
    </Button>
  )
}

export default CourseArchiveButton
