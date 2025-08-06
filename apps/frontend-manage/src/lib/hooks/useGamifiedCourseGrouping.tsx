import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/activities/ActivityCreation'

interface useGamifiedCourseGroupingProps {
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  assessmentCourses: ElementSelectCourse[]
}

function useGamifiedCourseGrouping({
  gamifiedCourses,
  nonGamifiedCourses,
  assessmentCourses,
}: useGamifiedCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
    {
      items: assessmentCourses.map((course) => ({ ...course, disabled: true })),
      label: t('shared.generic.assessment'),
    },
    {
      items: gamifiedCourses,
      label: t('shared.generic.gamified'),
    },
    {
      items: nonGamifiedCourses,
      label: t('shared.generic.nonGamified'),
    },
  ]
}

export default useGamifiedCourseGrouping
