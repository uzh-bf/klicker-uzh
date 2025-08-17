import { useSuspenseQuery } from '@apollo/client'
import {
  GetCourseActivityIdsDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

function SuspendedActivities({
  activeCourseId,
  activeActivityId,
  toggleCourseIdFilter,
  toggleActivityIdFilter,
}: {
  activeCourseId?: string
  activeActivityId?: string
  toggleCourseIdFilter: ({ courseId }: { courseId?: string }) => void
  toggleActivityIdFilter: ({ activityId }: { activityId?: string }) => void
}) {
  const t = useTranslations()
  const { data: userCourses } = useSuspenseQuery(GetUserCoursesDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const { data: courseActivities } = useSuspenseQuery(
    GetCourseActivityIdsDocument,
    {
      variables: { courseId: activeCourseId },
      fetchPolicy: 'cache-and-network',
    }
  )

  // combine the activities in a course into the format required by the select field
  const activities = useMemo(
    () => [
      {
        label: t('shared.generic.liveQuizzes'),
        items:
          courseActivities?.getCourseActivityIds?.liveQuizzes.map((quiz) => ({
            value: quiz.id,
            label: quiz.name,
          })) || [],
      },
      {
        label: t('shared.generic.practiceQuizzes'),
        items:
          courseActivities?.getCourseActivityIds?.practiceQuizzes.map(
            (quiz) => ({
              value: quiz.id,
              label: quiz.name,
            })
          ) || [],
      },
      {
        label: t('shared.generic.microlearnings'),
        items:
          courseActivities?.getCourseActivityIds?.microLearnings.map((ml) => ({
            value: ml.id,
            label: ml.name,
          })) || [],
      },
      {
        label: t('shared.generic.groupActivities'),
        items:
          courseActivities?.getCourseActivityIds?.groupActivities.map((ga) => ({
            value: ga.id,
            label: ga.name,
          })) || [],
      },
    ],
    [courseActivities, t]
  )

  // group the activities by type for the select field
  return (
    <div>
      <SelectField
        id="course-select"
        label={t('shared.generic.course')}
        value={activeCourseId ?? 'no-course'}
        items={[
          { value: 'no-course', label: 'No Course' },
          ...(userCourses.userCourses?.map((course) => ({
            value: course.id,
            label: course.displayName || course.name,
          })) || []),
        ]}
        onChange={(courseId) => {
          // if course changes, reset activity selection
          if (courseId !== activeCourseId) {
            toggleActivityIdFilter({ activityId: undefined })
          }
          toggleCourseIdFilter({
            courseId: courseId === 'no-course' ? undefined : courseId,
          })
        }}
        data={{ cy: 'activities-course-select' }}
        className={{
          root: 'px-1.5',
          label: 'mt-0',
          select: { trigger: 'w-46 h-7 text-sm', item: 'text-sm' },
        }}
      />

      <SelectField
        id="activity-select"
        placeholder={t('manage.questionPool.selectActivity')}
        disabled={Object.values(activities).every(
          (group) => group.items.length === 0
        )}
        label={t('shared.generic.activity')}
        groups={activities}
        value={activeActivityId ?? ''}
        onChange={(activityId) => toggleActivityIdFilter({ activityId })}
        data={{ cy: 'activities-activity-select' }}
        className={{
          root: 'mb-1.5 px-1.5',
          select: { trigger: 'w-46 h-7 text-sm', item: 'text-sm' },
        }}
      />
    </div>
  )
}

export default SuspendedActivities
