import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/activities/ElementCreation'

interface UseGroupActivityCourseGroupingProps {
  coursesWithGroups: ElementSelectCourse[]
  assessmentCoursesWithGroups: ElementSelectCourse[]
  coursesWithoutGroups: ElementSelectCourse[]
}

function useGroupActivityCourseGrouping({
  coursesWithGroups,
  assessmentCoursesWithGroups,
  coursesWithoutGroups,
}: UseGroupActivityCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
    {
      items: coursesWithGroups,
      label: t('manage.course.withGroups'),
    },
    {
      items: assessmentCoursesWithGroups.map((course) => ({
        ...course,
        disabled: true,
      })),
      label: t('manage.course.assessmentWithGroups'),
    },
    {
      items: coursesWithoutGroups.map((course) => ({
        ...course,
        disabled: true,
      })),
      label: t('manage.course.withoutGroups'),
    },
  ]
}

export default useGroupActivityCourseGrouping
