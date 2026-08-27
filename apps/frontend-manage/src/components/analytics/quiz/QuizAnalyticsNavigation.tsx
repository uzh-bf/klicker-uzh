import { useQuery } from '@apollo/client'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetCourseActivitiesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'

function QuizAnalyticsNavigation({
  courseId,
  activityId,
}: {
  courseId: string
  activityId: string
}) {
  const { data, loading } = useQuery(GetCourseActivitiesDocument, {
    variables: { courseId },
    fetchPolicy: 'network-only',
  })
  const t = useTranslations()
  const router = useRouter()

  if (loading) {
    return <Loader />
  }

  return (
    <div className="mb-6 grid w-full grid-cols-3">
      <Link
        href={`/analytics/${courseId}/quizzes`}
        className="flex flex-row items-center gap-2"
      >
        <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        <div className="flex flex-row items-center gap-0.5">
          {t('manage.analytics.backToActivitySelection')}
        </div>
      </Link>
      <div className="flex justify-center">
        <SelectField
          label={`${t('shared.generic.activity')}:`}
          labelType="large"
          value={activityId}
          groups={[
            ...(data?.getCourseActivities?.practiceQuizzes &&
            data.getCourseActivities.practiceQuizzes.length > 0
              ? [
                  {
                    label: `${t('shared.generic.practiceQuizzes')}:`,
                    items:
                      data?.getCourseActivities?.practiceQuizzes?.map(
                        (activity) => ({
                          label: activity.name,
                          value: activity.id,
                        })
                      ) ?? [],
                  },
                ]
              : []),
            ...(data?.getCourseActivities?.microLearnings &&
            data.getCourseActivities.microLearnings.length > 0
              ? [
                  {
                    label: `${t('shared.generic.microlearnings')}:`,
                    items:
                      data?.getCourseActivities?.microLearnings?.map(
                        (activity) => ({
                          label: activity.name,
                          value: activity.id,
                        })
                      ) ?? [],
                  },
                ]
              : []),
          ]}
          onChange={(value) => {
            router.push({ pathname: `/analytics/${courseId}/quizzes/${value}` })
          }}
          className={{ select: { trigger: 'h-8' } }}
        />
      </div>
    </div>
  )
}

export default QuizAnalyticsNavigation
