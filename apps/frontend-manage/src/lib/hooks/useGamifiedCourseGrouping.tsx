import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/activities/ElementCreation'

interface useGamifiedCourseGroupingProps {
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
}

function useGamifiedCourseGrouping({
  gamifiedCourses,
  nonGamifiedCourses,
}: useGamifiedCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
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
