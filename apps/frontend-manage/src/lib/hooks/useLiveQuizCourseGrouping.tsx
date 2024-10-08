import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/sessions/creation/ElementCreation'

interface useLiveQuizCourseGroupingProps {
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
}

function useLiveQuizCourseGrouping({
  gamifiedCourses,
  nonGamifiedCourses,
}: useLiveQuizCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
    {
      items: [
        {
          label: t('manage.sessionForms.liveQuizNoCourse'),
          value: '',
          data: {
            cy: `select-course-${t('manage.sessionForms.liveQuizNoCourse')}`,
          },
        },
      ],
    },
    {
      items: gamifiedCourses,
      showSeparator: true,
      label: t('shared.generic.gamified'),
    },
    {
      items: nonGamifiedCourses,
      showSeparator: true,
      label: t('shared.generic.nonGamified'),
    },
  ]
}

export default useLiveQuizCourseGrouping
