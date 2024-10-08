import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/sessions/creation/ElementCreation'

interface UseGroupsCourseGroupingProps {
  coursesWithGroups: ElementSelectCourse[]
  coursesWithoutGroups: ElementSelectCourse[]
}

function useGroupsCourseGrouping({
  coursesWithGroups,
  coursesWithoutGroups,
}: UseGroupsCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
    {
      items: coursesWithGroups,
      showSeparator: true,
      label: t('shared.generic.withGroups'),
    },
    {
      items: coursesWithoutGroups,
      showSeparator: true,
      label: t('shared.generic.withoutGroups'),
    },
  ]
}

export default useGroupsCourseGrouping
