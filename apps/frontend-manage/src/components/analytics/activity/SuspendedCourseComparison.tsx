import { useSuspenseQuery } from '@apollo/client'
import { GetLearningAnalyticsCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Checkbox, H3, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'

function SuspendedCourseComparison({
  courseComparison,
  setCourseComparison,
  comparisonCourseLoading,
}: {
  courseComparison: { id: string; name: string } | undefined
  setCourseComparison: (
    course: { id: string; name: string } | undefined
  ) => void
  comparisonCourseLoading: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [showCourseDropdown, setShowCourseDropdown] = useState(false)

  const { data } = useSuspenseQuery(GetLearningAnalyticsCoursesDocument)
  const courses =
    data.userCourses
      ?.filter(
        (course) =>
          course.id !== router.query.courseId &&
          course.isLearningAnalyticsEnabled &&
          course.analyticsStatus.areAnalyticsValid
      )
      .map((course) => ({
        label: course.name,
        value: course.id,
      })) ?? []

  return (
    <div className="w-full px-4 lg:w-1/4">
      <div className="flex flex-row items-center gap-2">
        <Checkbox
          checked={showCourseDropdown}
          onCheck={() =>
            setShowCourseDropdown((prev) => {
              if (prev) {
                setCourseComparison(undefined)
              }
              return !prev
            })
          }
          className={{ root: 'border-black' }}
        />
        <H3 className={{ root: 'mb-0' }}>
          {t('manage.analytics.courseComparison')}
        </H3>
      </div>
      {showCourseDropdown ? (
        <div className="flex flex-col gap-2 pl-7">
          <div>{t('manage.analytics.courseComparisonDescription')}</div>
          <div className="flex w-full flex-row">
            <Select
              items={courses}
              value={courseComparison?.id}
              onChange={(newValue) =>
                setCourseComparison({
                  id: newValue,
                  name:
                    courses.find((course) => course.value === newValue)
                      ?.label ?? '',
                })
              }
              placeholder={t('manage.analytics.selectCourse')}
            />
            {comparisonCourseLoading && <Loader />}
          </div>
        </div>
      ) : undefined}
    </div>
  )
}

export default SuspendedCourseComparison
