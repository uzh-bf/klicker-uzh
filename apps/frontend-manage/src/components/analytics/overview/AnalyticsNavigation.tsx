import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { SelectField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { trpc } from '../../../lib/trpc'

interface AnalyticsNavigationProps {
  hrefLeft: string
  labelLeft: React.ReactNode
  hrefRight: string
  labelRight: React.ReactNode
  slug: string
}

function AnalyticsNavigation({
  hrefLeft,
  labelLeft,
  hrefRight,
  labelRight,
  slug,
}: AnalyticsNavigationProps) {
  const { data, error, isLoading } = trpc.course.userCourses.useQuery()
  const router = useRouter()
  const t = useTranslations()
  const selectedCourseId =
    typeof router.query.courseId === 'string' ? router.query.courseId : ''

  return (
    <div className="mb-6 grid w-full grid-cols-2 md:grid-cols-3">
      <Link
        href={hrefLeft}
        className="flex flex-row items-center justify-start gap-2"
      >
        <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        <div className="flex flex-row items-center gap-0.5">{labelLeft}</div>
      </Link>
      <div className="hidden justify-center md:flex">
        {isLoading && !data ? (
          <Loader />
        ) : !data?.userCourses ? (
          <UserNotification
            type="error"
            message={t('manage.analytics.analyticsLoadingFailed')}
            className={{ root: 'text-sm' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <SelectField
              label={`${t('shared.generic.course')}:`}
              labelType="large"
              value={selectedCourseId}
              items={data.userCourses.map((course) => ({
                label: course.name,
                value: course.id,
              }))}
              onChange={(value) => {
                router.push({ pathname: `/analytics/${value}/${slug}` })
              }}
              className={{ select: { trigger: 'h-8' } }}
            />
            {error ? (
              <UserNotification
                type="error"
                message={t('manage.analytics.analyticsLoadingFailed')}
                className={{ root: 'py-1 text-sm' }}
              />
            ) : null}
          </div>
        )}
      </div>
      <Link
        href={hrefRight}
        className="flex flex-row items-center justify-end gap-2"
      >
        <div className="flex flex-row items-center gap-0.5">{labelRight}</div>
        <FontAwesomeIcon icon={faChevronRight} size="lg" />
      </Link>
    </div>
  )
}

export default AnalyticsNavigation
