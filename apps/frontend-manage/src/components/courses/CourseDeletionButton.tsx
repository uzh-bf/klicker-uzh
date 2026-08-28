import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { Button } from '@uzh-bf/design-system'
import type { Dispatch, SetStateAction } from 'react'
import { useCourseDeletionStatus } from './CourseDeletionStatusProvider'

function CourseDeletionButton({
  id,
  name,
  isAssessmentEnabled,
  showDeletionModal,
}: {
  id: string
  name: string
  isAssessmentEnabled: boolean
  showDeletionModal?: Dispatch<
    SetStateAction<{ open: boolean; courseId: string | null }>
  >
}) {
  const { isCourseDeletionActive, isCourseDeletionStatusHydrating } =
    useCourseDeletionStatus()
  const deletionActive = isCourseDeletionActive(id)

  return (
    <Button
      disabled={
        isAssessmentEnabled || deletionActive || isCourseDeletionStatusHydrating
      }
      className={{
        root: 'h-9 w-9 border-red-600 text-red-600 hover:text-red-600',
      }}
      onClick={(e) => {
        e?.stopPropagation()
        e?.preventDefault()
        showDeletionModal?.({ open: true, courseId: id })
      }}
      data={{ cy: `delete-course-${name}` }}
    >
      <Button.Icon withoutLabel icon={faTrashCan} loading={deletionActive} />
    </Button>
  )
}

export default CourseDeletionButton
