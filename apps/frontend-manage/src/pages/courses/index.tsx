import { useQuery } from '@apollo/client'
import { faPeopleGroup, faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../../components/Layout'
import CourseListButton from '../../components/courses/CourseListButton'
import CourseCreationModal from '../../components/courses/modals/CourseCreationModal'

function CourseSelectionPage() {
  const router = useRouter()
  const t = useTranslations()
  const [createCourseModal, showCreateCourseModal] = useState(false)
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  if (loadingCourses) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex justify-center w-full">
        <div className="flex flex-col w-max">
          <H3>{t('manage.courseList.selectCourse')}:</H3>
          {dataCourses?.userCourses && dataCourses.userCourses.length > 0 ? (
            <div className="md:w-[30rem] w-[20rem]">
              <div className="flex flex-col gap-2">
                {dataCourses.userCourses.map((course) => (
                  <CourseListButton
                    key={course.id}
                    onClick={() => router.push(`/courses/${course.id}`)}
                    icon={faPeopleGroup}
                    label={course.displayName}
                  />
                ))}
                <CourseListButton
                  onClick={() => showCreateCourseModal(true)}
                  icon={faPlusCircle}
                  label={t('manage.courseList.createNewCourse')}
                />
              </div>
            </div>
          ) : (
            <div className="md:w-[30rem] w-[20rem]">
              <UserNotification
                type="warning"
                className={{ root: 'text-normal mb-3' }}
              >
                {t('manage.courseList.noCoursesFound')}
              </UserNotification>
              <CourseListButton
                onClick={() => showCreateCourseModal(true)}
                icon={faPlusCircle}
                label={t('manage.courseList.createCourseNow')}
              />
            </div>
          )}
          <CourseCreationModal
            modalOpen={createCourseModal}
            onModalClose={() => showCreateCourseModal(false)}
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`))
        .default,
    },
  }
}

export default CourseSelectionPage
