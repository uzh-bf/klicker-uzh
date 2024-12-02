import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/activities/ElementCreation'

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
          label: t('manage.activityWizard.liveQuizNoCourse'),
          value: '',
          data: {
            cy: `select-course-${t('manage.activityWizard.liveQuizNoCourse')}`,
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
