import { useQuery } from '@apollo/client'
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetLearningAnalyticsCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { isCourseLearningAnalyticsAvailable } from '../courseEligibility'

interface AnalyticsNavigationProps {
  hrefLeft?: string
  labelLeft?: React.ReactNode
  hrefRight?: string
  labelRight?: React.ReactNode
  slug: string
}

function AnalyticsNavigation({
  hrefLeft,
  labelLeft,
  hrefRight,
  labelRight,
  slug,
}: AnalyticsNavigationProps) {
  const { data, loading } = useQuery(GetLearningAnalyticsCoursesDocument, {
    fetchPolicy: 'network-only',
  })
  const router = useRouter()
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  return (
    <div
      className="mb-6 grid w-full grid-cols-2 md:grid-cols-3"
      data-cy="analytics-dashboard-navigation"
    >
      {hrefLeft && labelLeft ? (
        <Link
          href={hrefLeft}
          className="flex flex-row items-center justify-start gap-2"
        >
          <FontAwesomeIcon icon={faChevronLeft} size="lg" />
          <div className="flex flex-row items-center gap-0.5">{labelLeft}</div>
        </Link>
      ) : (
        <div />
      )}
      <div className="hidden justify-center md:flex">
        <SelectField
          label={`${t('shared.generic.course')}:`}
          labelType="large"
          value={router.query.courseId as string}
          items={
            data?.userCourses
              ?.filter(isCourseLearningAnalyticsAvailable)
              .map((course) => ({
                label: course.name,
                value: course.id,
              })) ?? []
          }
          onChange={(value) => {
            router.push({ pathname: `/analytics/${value}/${slug}` })
          }}
          className={{ select: { trigger: 'h-8' } }}
        />
      </div>
      {hrefRight && labelRight ? (
        <Link
          href={hrefRight}
          className="flex flex-row items-center justify-end gap-2"
        >
          <div className="flex flex-row items-center gap-0.5">{labelRight}</div>
          <FontAwesomeIcon icon={faChevronRight} size="lg" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}

export default AnalyticsNavigation
