import type { CourseSummary } from '@klicker-uzh/graphql/dist/ops'
import { Checkbox } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'

interface CourseDeletionConfirmationsProps {
  summary: CourseSummary
  deleteDraftActivities: boolean
  setDeleteDraftActivities: Dispatch<SetStateAction<boolean>>
}

function CourseDeletionConfirmations({
  summary,
  deleteDraftActivities,
  setDeleteDraftActivities,
}: CourseDeletionConfirmationsProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-gray-700">
        {t('manage.courseList.courseDeletionMessage')}
      </p>
      {summary.numOfDraftActivities > 0 && (
        <div className="flex min-h-10 flex-row items-center border-t pt-4">
          <Checkbox
            checked={deleteDraftActivities}
            onCheck={() => setDeleteDraftActivities((value) => !value)}
            label={t('manage.courseList.deleteDraftActivitiesOption', {
              number: summary.numOfDraftActivities,
            })}
            className={{ label: 'mr-4' }}
            data={{ cy: 'course-deletion-delete-draft-activities' }}
          />
        </div>
      )}
    </div>
  )
}

export default CourseDeletionConfirmations
