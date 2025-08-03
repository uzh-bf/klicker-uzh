import { SelectGroup } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementSelectCourse } from '../../components/activities/ElementCreation'

interface useLiveQuizCourseGroupingProps {
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  assessmentCourses: ElementSelectCourse[]
}

function useLiveQuizCourseGrouping({
  gamifiedCourses,
  nonGamifiedCourses,
  assessmentCourses,
}: useLiveQuizCourseGroupingProps): SelectGroup[] {
  const t = useTranslations()

  return [
    {
      items: [
        {
          label: t('manage.activityWizard.liveQuizNoCourse'),
          value: 'no-course-selected',
          data: {
            cy: `select-course-${t('manage.activityWizard.liveQuizNoCourse')}`,
          },
        },
      ],
    },
    {
      items: assessmentCourses,
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

export default useLiveQuizCourseGrouping
