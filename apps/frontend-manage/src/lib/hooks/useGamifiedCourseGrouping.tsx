import { Group } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/sessions/creation/ElementCreation'

interface useGamifiedCourseGroupingProps {
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
}

function useGamifiedCourseGrouping({
  gamifiedCourses,
  nonGamifiedCourses,
}: useGamifiedCourseGroupingProps): Group[] {
  const t = useTranslations()

  return [
    {
      items: gamifiedCourses,
      showSeparator: true,
      label: t('shared.generic.gamified'),
    },
    {
      items: nonGamifiedCourses.map((course) => {
        return { ...course, disabled: true }
      }),
      showSeparator: true,
      label: t('shared.generic.nonGamified'),
    },
  ]
}

export default useGamifiedCourseGrouping
