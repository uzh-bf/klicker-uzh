import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ActivityBatchOperationActions,
  ActivityBatchOperationCourse,
} from './types'

interface ActivityCourseCardProps {
  courses: ActivityBatchOperationCourse[]
  selectedActions: ActivityBatchOperationActions
  setSelectedActions: Dispatch<SetStateAction<ActivityBatchOperationActions>>
}

function ActivityCourseCardContent({
  courses,
  selectedActions,
  setSelectedActions,
  noCoursesAvailable,
}: ActivityCourseCardProps & { noCoursesAvailable: boolean }) {
  const t = useTranslations()

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3',
        typeof selectedActions.course !== 'undefined' &&
          'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="flex w-full flex-row items-center justify-between font-normal">
          <span className={twMerge(noCoursesAvailable && 'opacity-50')}>
            {t('manage.activities.changeCourse')}
          </span>
          {noCoursesAvailable && (
            <FontAwesomeIcon
              size="sm"
              icon={faLock}
              className="text-uzh-red-100"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2">
          <Checkbox
            disabled={noCoursesAvailable}
            checked={typeof selectedActions.course !== 'undefined'}
            onCheck={() => {
              setSelectedActions((prev) => ({
                ...prev,
                course:
                  typeof prev.course !== 'undefined'
                    ? undefined
                    : {
                        id: undefined,
                        isGamificationEnabled: true,
                        isAssessmentEnabled: true,
                        isGroupCreationEnabled: true,
                        startDate: null,
                        endDate: null,
                        groupDeadlineDate: null,
                      },
              }))
            }}
            data={{ cy: 'course-checkbox' }}
          />
          <Select
            value={selectedActions.course?.id ?? ''}
            placeholder={t('manage.activityWizard.selectCourse')}
            onChange={(value) => {
              const selectedCourse = courses.find(
                (course) => course.id === value
              )

              setSelectedActions((prev) => ({
                ...prev,
                course: selectedCourse
                  ? {
                      id: selectedCourse.id,
                      isGamificationEnabled:
                        selectedCourse.isGamificationEnabled,
                      isAssessmentEnabled: selectedCourse.isAssessmentEnabled,
                      isGroupCreationEnabled:
                        selectedCourse.isGroupCreationEnabled,
                      startDate: selectedCourse.startDate,
                      endDate: selectedCourse.endDate,
                      groupDeadlineDate: selectedCourse.groupDeadlineDate,
                    }
                  : undefined,
              }))
            }}
            items={courses.map((course) => ({
              label: course.name,
              value: course.id,
            }))}
            data={{ cy: 'select-course' }}
            className={{
              root: 'h-8',
              trigger: 'h-8 w-56 lg:w-44',
            }}
            disabled={typeof selectedActions.course === 'undefined'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityCourseCard({
  courses,
  selectedActions,
  setSelectedActions,
}: ActivityCourseCardProps) {
  const t = useTranslations()
  const noCoursesAvailable = courses.length === 0

  return noCoursesAvailable ? (
    <Tooltip delay={0} tooltip={t('manage.activities.batchNoCoursesAvailable')}>
      <ActivityCourseCardContent
        courses={courses}
        selectedActions={selectedActions}
        setSelectedActions={setSelectedActions}
        noCoursesAvailable={noCoursesAvailable}
      />
    </Tooltip>
  ) : (
    <ActivityCourseCardContent
      courses={courses}
      selectedActions={selectedActions}
      setSelectedActions={setSelectedActions}
      noCoursesAvailable={noCoursesAvailable}
    />
  )
}

export default ActivityCourseCard
